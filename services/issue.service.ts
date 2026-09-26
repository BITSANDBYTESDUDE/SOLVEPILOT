import "server-only";

import { Types } from "mongoose";

import { requireWorkspaceMember } from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError, zodErrorToDetails } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { Issue, Project, User, type IssueDocument } from "@/models";
import { createActivity } from "@/services/activity.service";
import { canCreateIssue, canViewIssues } from "@/services/permission.service";
import type { IssueCategory, IssuePriority, IssueSource, IssueStatus } from "@/types/domain";
import { ISSUE_CREATION_SOURCE } from "@/lib/constants/issues";
import { createIssueSchema } from "@/validators/issue";

const log = logger.child("issue:service");

/**
 * How many problems the first-version list returns.
 *
 * Task 11 renders a plain recency list; Task 12 replaces this cap with real
 * search, filtering and pagination.
 */
export const ISSUE_LIST_LIMIT = 100;

export interface IssueSummary {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  source: IssueSource;
  createdBy: string;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueDetail extends IssueSummary {
  description: string;
  /** Always null until AI classification runs (Task 17). */
  aiConfidence: number | null;
  /** Always null until planning runs (Task 19). */
  estimatedMinutes: number | null;
  resolvedAt: Date | null;
  creatorEmail: string | null;
}

/** Trusted input: ids come from the session and the URL, never from the body. */
export interface IssueCreateInput {
  workspaceId: string;
  userId: string;
  projectId: string | null;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
}

type StoredIssue = IssueDocument & { _id: Types.ObjectId };

/**
 * Problem creation service (Task 11).
 *
 * A problem is always created *inside a workspace the caller belongs to*, and
 * may optionally be attached to a project of that same workspace. Both checks run
 * server-side before anything is written; the request body contributes nothing
 * but the problem's own content.
 *
 * Deliberately out of scope here: AI classification, diagnosis, planning, task
 * generation, file inputs, evidence, verification, reports and notifications.
 */

/**
 * Build the document that is handed to `Issue.create()`.
 *
 * Exported (and unit-tested) because this is where "the client cannot forge
 * server-controlled fields" is actually enforced: `status`, `source`,
 * `aiConfidence`, `estimatedMinutes`, `resolvedAt` and `assignedTo` are written
 * from constants, and `createdBy`/`workspaceId` only ever come from the session
 * and the workspace in the URL.
 */
export function buildIssueDocument(input: IssueCreateInput): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(input.workspaceId),
    projectId: input.projectId ? new Types.ObjectId(input.projectId) : null,
    createdBy: new Types.ObjectId(input.userId),
    assignedTo: null,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    // Every new problem enters the lifecycle here; later tasks move it forward.
    status: "new",
    // Text is the only capture mode implemented in Task 11.
    source: ISSUE_CREATION_SOURCE,
    // AI-owned fields stay empty until their own tasks run.
    aiConfidence: null,
    estimatedMinutes: null,
    resolvedAt: null,
  };
}

/**
 * Confirm a project really belongs to the workspace the problem is created in.
 *
 * Answers the same way whether the project does not exist at all or exists in
 * another workspace, so the endpoint cannot be used to probe for other tenants'
 * project ids.
 */
export function assertProjectInWorkspace<TProject extends { workspaceId: unknown }>(
  project: TProject | null,
  workspaceId: string,
): asserts project is TProject {
  if (!project || String(project.workspaceId) !== String(workspaceId)) {
    throw new ForbiddenError("That project does not belong to this workspace.");
  }
}

/** Load the project and prove it belongs to this workspace. */
async function resolveWorkspaceProject(
  projectId: string,
  workspaceId: string,
): Promise<Types.ObjectId> {
  const project = await Project.findOne({
    _id: new Types.ObjectId(projectId),
    workspaceId: new Types.ObjectId(workspaceId),
  })
    .select("_id workspaceId")
    .lean<{ _id: Types.ObjectId; workspaceId: Types.ObjectId } | null>();

  assertProjectInWorkspace(project, workspaceId);

  return project._id;
}

/**
 * Activity metadata for a created problem.
 *
 * Identifiers and the title only — never the description, which can contain
 * customer data, credentials or anything else a user pasted in.
 */
export function issueCreatedMetadata(input: {
  issueId: string;
  title: string;
  projectId: string | null;
}): Record<string, unknown> {
  return {
    issueId: input.issueId,
    title: input.title,
    projectId: input.projectId,
  };
}

interface IssueLookupMaps {
  projectNames: Map<string, string>;
  creators: Map<string, { name: string; email: string }>;
}

async function loadIssueLookups(issues: StoredIssue[]): Promise<IssueLookupMaps> {
  const projectIds = [
    ...new Set(issues.flatMap((i) => (i.projectId ? [String(i.projectId)] : []))),
  ];
  const creatorIds = [...new Set(issues.map((i) => String(i.createdBy)))];

  const [projects, creators] = await Promise.all([
    projectIds.length > 0
      ? Project.find({ _id: { $in: projectIds } })
          .select("_id name")
          .lean<Array<{ _id: Types.ObjectId; name: string }>>()
      : Promise.resolve<Array<{ _id: Types.ObjectId; name: string }>>([]),
    creatorIds.length > 0
      ? User.find({ _id: { $in: creatorIds } })
          .select("_id name email")
          .lean<Array<{ _id: Types.ObjectId; name: string; email: string }>>()
      : Promise.resolve<Array<{ _id: Types.ObjectId; name: string; email: string }>>([]),
  ]);

  return {
    projectNames: new Map(projects.map((p) => [String(p._id), p.name])),
    creators: new Map(creators.map((u) => [String(u._id), { name: u.name, email: u.email }])),
  };
}

function toIssueSummary(issue: StoredIssue, lookups: IssueLookupMaps): IssueSummary {
  const projectId = issue.projectId ? String(issue.projectId) : null;
  const creator = lookups.creators.get(String(issue.createdBy)) ?? null;

  return {
    id: String(issue._id),
    workspaceId: String(issue.workspaceId),
    projectId,
    projectName: projectId ? (lookups.projectNames.get(projectId) ?? null) : null,
    title: issue.title,
    category: issue.category,
    priority: issue.priority,
    status: issue.status,
    source: issue.source,
    createdBy: String(issue.createdBy),
    creatorName: creator?.name ?? null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function toIssueDetail(issue: StoredIssue, lookups: IssueLookupMaps): IssueDetail {
  const creator = lookups.creators.get(String(issue.createdBy)) ?? null;

  return {
    ...toIssueSummary(issue, lookups),
    description: issue.description,
    aiConfidence: issue.aiConfidence,
    estimatedMinutes: issue.estimatedMinutes,
    resolvedAt: issue.resolvedAt,
    creatorEmail: creator?.email ?? null,
  };
}

/**
 * Create a problem in the workspace.
 *
 * `workspaceId` and `userId` are trusted server-side values (URL segment and
 * session); `input` is the raw request body and is validated before use.
 */
export async function createIssue(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<IssueDetail> {
  // 1. Tenancy: the caller must belong to the workspace in the URL.
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canCreateIssue(membership.role)) {
    throw new ForbiddenError("You do not have permission to create problems in this workspace.");
  }

  // 2. Content: only user-choosable fields survive parsing.
  const parsed = createIssueSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      "Please check the problem details and try again.",
      zodErrorToDetails(parsed.error),
    );
  }

  const { title, description, category, priority, projectId } = parsed.data;

  await connectToDatabase();

  // 3. Optional project association, verified against this workspace.
  const resolvedProjectId = projectId
    ? (await resolveWorkspaceProject(projectId, workspaceId)).toString()
    : null;

  // 4. Persist.
  const created = (await Issue.create(
    buildIssueDocument({
      workspaceId,
      userId,
      projectId: resolvedProjectId,
      title,
      description,
      category,
      priority,
    }),
  )) as unknown as StoredIssue;

  // 5. Audit. Awaited so the timeline is never a step behind the problem.
  await createActivity({
    workspaceId,
    actorId: userId,
    action: "issue.created",
    issueId: String(created._id),
    metadata: issueCreatedMetadata({
      issueId: String(created._id),
      title: created.title,
      projectId: resolvedProjectId,
    }),
  });

  log.info("issue created", {
    workspaceId,
    projectId: resolvedProjectId,
    issueId: String(created._id),
    userId,
  });

  const lookups = await loadIssueLookups([created]);
  return toIssueDetail(created, lookups);
}

/**
 * Retrieve a single problem, scoped to the workspace.
 *
 * A problem from another workspace is indistinguishable from one that does not
 * exist, which keeps the endpoint from becoming an IDOR probe.
 */
export async function getIssueById(
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<IssueDetail> {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canViewIssues(membership.role)) {
    throw new ForbiddenError("You do not have permission to view problems in this workspace.");
  }

  if (!Types.ObjectId.isValid(issueId)) {
    throw new NotFoundError("That problem does not exist in this workspace.");
  }

  await connectToDatabase();

  const issue = await Issue.findOne({
    _id: new Types.ObjectId(issueId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean<StoredIssue | null>();

  if (!issue) {
    throw new NotFoundError("That problem does not exist in this workspace.");
  }

  const lookups = await loadIssueLookups([issue]);
  return toIssueDetail(issue, lookups);
}

/**
 * List the workspace's problems, newest first.
 *
 * Basic recency listing only — search, filters, sorting and pagination arrive
 * with Task 12.
 */
export async function getWorkspaceIssues(
  userId: string,
  workspaceId: string,
): Promise<IssueSummary[]> {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canViewIssues(membership.role)) {
    throw new ForbiddenError("You do not have permission to view problems in this workspace.");
  }

  await connectToDatabase();

  const issues = await Issue.find({ workspaceId: new Types.ObjectId(workspaceId) })
    .sort({ createdAt: -1 })
    .limit(ISSUE_LIST_LIMIT)
    .lean<StoredIssue[]>();

  const lookups = await loadIssueLookups(issues);
  return issues.map((issue) => toIssueSummary(issue, lookups));
}
