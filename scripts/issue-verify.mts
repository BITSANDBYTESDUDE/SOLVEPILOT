/**
 * Problem (issue) creation verification tooling (Task 11).
 *
 * Static sections (no database needed) cover: field validation, the Issue schema
 * and its indexes, the permission matrix, the server-controlled document build,
 * workspace/project authorization decisions, activity metadata and the shared
 * label/draft rules the form uses.
 *
 * The live section (only when MONGODB_URI is set) exercises the real service:
 * creation as owner/admin/member, defaults, cross-workspace rejection,
 * cross-project rejection, the `issue.created` activity record and
 * retrieval isolation. Fixtures are created and removed by the script.
 *
 * Usage:  npm run issue:verify
 */
import { createRequire } from "node:module";

import { Types, type Model } from "mongoose";

import { findMembership } from "@/lib/auth/workspace";
import {
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_DESCRIPTION_MIN_LENGTH,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_STATUS_LABELS,
  ISSUE_TITLE_MIN_LENGTH,
  issueCategoryLabel,
  issueDraftErrors,
  issuePriorityLabel,
  issueStatusLabel,
} from "@/lib/constants/issues";
import { connectToDatabase, disconnectFromDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { AppError } from "@/lib/errors";
import * as models from "@/models";
import { sanitizeMetadata } from "@/services/activity.service";
import {
  assertProjectInWorkspace,
  buildIssueDocument,
  createIssue,
  getIssueById,
  getWorkspaceIssues,
  issueCreatedMetadata,
} from "@/services/issue.service";
import { canCreateIssue, canViewIssues } from "@/services/permission.service";
import { ACTIVITY_ACTION_TYPES, ACTIVITY_ACTIONS, ISSUE_CATEGORIES } from "@/types/domain";
import {
  createIssueSchema,
  issueCategorySchema,
  issueDescriptionSchema,
  issuePrioritySchema,
  issueProjectIdSchema,
  issueTitleSchema,
} from "@/validators/issue";

import { isValid, VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

const objectId = () => new Types.ObjectId();

const VALID_DESCRIPTION = "The navigation menu goes outside the viewport on mobile devices.";

/** Run `fn` and return the thrown `AppError`, or null when it did not throw. */
async function thrown(fn: () => Promise<unknown>): Promise<AppError | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof AppError
      ? error
      : new AppError({ message: "unexpected", code: "INTERNAL_ERROR", statusCode: 500 });
  }
}

function indexNamesOf<TDocument>(model: Model<TDocument>): string[] {
  return model.schema
    .indexes()
    .map(([fields]) => Object.keys(fields as Record<string, unknown>).join("+"));
}

/* -------------------------------------------------------------------------- */
/* 1. Title validation                                                        */
/* -------------------------------------------------------------------------- */

section("Problem title validation", [
  {
    description: "accepts a valid title",
    test: () => issueTitleSchema.safeParse("Mobile navbar is broken").success,
  },
  {
    description: "trims surrounding whitespace",
    test: () => issueTitleSchema.parse("  Mobile navbar  ") === "Mobile navbar",
  },
  {
    description: "rejects a missing title",
    test: () => !issueTitleSchema.safeParse(undefined).success,
  },
  {
    description: "rejects an empty title",
    test: () => !issueTitleSchema.safeParse("").success,
  },
  {
    description: "rejects a whitespace-only title",
    test: () => !issueTitleSchema.safeParse("     ").success,
  },
  {
    description: `rejects a title shorter than ${ISSUE_TITLE_MIN_LENGTH} characters`,
    test: () => !issueTitleSchema.safeParse("ab").success,
  },
  {
    description: "accepts a title of exactly the minimum length",
    test: () => issueTitleSchema.parse("abc") === "abc",
  },
  {
    description: "rejects a title longer than 200 characters",
    test: () => !issueTitleSchema.safeParse("a".repeat(201)).success,
  },
  {
    description: "accepts a title of exactly 200 characters",
    test: () => issueTitleSchema.safeParse("a".repeat(200)).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Description validation                                                  */
/* -------------------------------------------------------------------------- */

section("Problem description validation", [
  {
    description: "accepts a valid description",
    test: () => issueDescriptionSchema.safeParse(VALID_DESCRIPTION).success,
  },
  {
    description: "rejects a missing description",
    test: () => !issueDescriptionSchema.safeParse(undefined).success,
  },
  {
    description: "rejects an empty description",
    test: () => !issueDescriptionSchema.safeParse("").success,
  },
  {
    description: `rejects a description shorter than ${ISSUE_DESCRIPTION_MIN_LENGTH} characters`,
    test: () => !issueDescriptionSchema.safeParse("too short").success,
  },
  {
    description: "accepts a description of exactly the minimum length",
    test: () => issueDescriptionSchema.safeParse("a".repeat(ISSUE_DESCRIPTION_MIN_LENGTH)).success,
  },
  {
    description: "rejects a description longer than 10,000 characters",
    test: () => !issueDescriptionSchema.safeParse("a".repeat(10_001)).success,
  },
  {
    description: "accepts a description of exactly 10,000 characters",
    test: () => issueDescriptionSchema.safeParse("a".repeat(10_000)).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Category & priority                                                     */
/* -------------------------------------------------------------------------- */

section("Category validation", [
  {
    description: "accepts exactly the six supported categories",
    test: () =>
      ["technical", "ui", "business", "productivity", "academic", "other"].every(
        (value) => issueCategorySchema.safeParse(value).success,
      ),
  },
  {
    description: "exposes exactly the six supported categories to the UI",
    test: () =>
      ISSUE_CATEGORY_OPTIONS.map((option) => option.value).join(",") ===
      [...ISSUE_CATEGORIES].join(","),
  },
  {
    description: "rejects an unknown category",
    test: () =>
      !issueCategorySchema.safeParse("design").success &&
      !issueCategorySchema.safeParse("TECHNICAL").success &&
      !issueCategorySchema.safeParse("").success,
  },
  {
    description: "defaults to 'other' when the user does not choose",
    test: () =>
      createIssueSchema.parse({ title: "Broken navbar", description: VALID_DESCRIPTION })
        .category === "other",
  },
  {
    description: "maps 'ui' to the human-readable label 'UI / Design'",
    test: () => issueCategoryLabel("ui") === "UI / Design",
  },
]);

section("Priority validation", [
  {
    description: "accepts exactly the four supported priorities",
    test: () =>
      ["low", "medium", "high", "critical"].every(
        (value) => issuePrioritySchema.safeParse(value).success,
      ),
  },
  {
    description: "exposes exactly the four supported priorities to the UI",
    test: () =>
      ISSUE_PRIORITY_OPTIONS.map((option) => option.value).join(",") === "low,medium,high,critical",
  },
  {
    description: "rejects an unknown priority",
    test: () =>
      !issuePrioritySchema.safeParse("urgent").success &&
      !issuePrioritySchema.safeParse("HIGH").success,
  },
  {
    description: "defaults to 'medium' when the user does not choose",
    test: () =>
      createIssueSchema.parse({ title: "Broken navbar", description: VALID_DESCRIPTION })
        .priority === "medium",
  },
  {
    description: "maps 'critical' to the label 'Critical'",
    test: () => issuePriorityLabel("critical") === "Critical",
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Creation payload                                                        */
/* -------------------------------------------------------------------------- */

section("Creation payload", [
  {
    description: "accepts a complete valid payload",
    test: () =>
      createIssueSchema.safeParse({
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "ui",
        priority: "high",
        projectId: objectId().toString(),
      }).success,
  },
  {
    description: "rejects a payload with a missing title",
    test: () =>
      !createIssueSchema.safeParse({ description: VALID_DESCRIPTION, category: "ui" }).success,
  },
  {
    description: "rejects a payload with a missing description",
    test: () => !createIssueSchema.safeParse({ title: "Broken navbar", category: "ui" }).success,
  },
  {
    description: "rejects a payload with an invalid category",
    test: () =>
      !createIssueSchema.safeParse({
        title: "Broken navbar",
        description: VALID_DESCRIPTION,
        category: "design",
      }).success,
  },
  {
    description: "rejects a payload with an invalid priority",
    test: () =>
      !createIssueSchema.safeParse({
        title: "Broken navbar",
        description: VALID_DESCRIPTION,
        priority: "urgent",
      }).success,
  },
  {
    description: "strips server-controlled fields from a forged payload",
    test: () => {
      const parsed = createIssueSchema.parse({
        title: "Broken navbar",
        description: VALID_DESCRIPTION,
        workspaceId: objectId().toString(),
        createdBy: objectId().toString(),
        status: "resolved",
        source: "pdf",
        aiConfidence: 0.99,
        estimatedMinutes: 5,
        resolvedAt: new Date().toISOString(),
      });
      return (
        !("workspaceId" in parsed) &&
        !("createdBy" in parsed) &&
        !("status" in parsed) &&
        !("source" in parsed) &&
        !("aiConfidence" in parsed) &&
        !("estimatedMinutes" in parsed) &&
        !("resolvedAt" in parsed)
      );
    },
  },
]);

section("Optional project association", [
  {
    description: "accepts a well-formed project id",
    test: () => {
      const id = objectId().toString();
      return issueProjectIdSchema.parse(id) === id;
    },
  },
  {
    description: "treats an empty string as 'No Project'",
    test: () => issueProjectIdSchema.parse("") === undefined,
  },
  {
    description: "treats 'none' as 'No Project'",
    test: () => issueProjectIdSchema.parse("none") === undefined,
  },
  {
    description: "rejects a malformed project id before any query runs",
    test: () =>
      !issueProjectIdSchema.safeParse("not-an-object-id").success &&
      !issueProjectIdSchema.safeParse("12345").success,
  },
  {
    description: "rejects a non-string project id",
    test: () => !issueProjectIdSchema.safeParse({ $oid: "abc" }).success,
  },
  {
    description: "creation payload without projectId parses with no association",
    test: () =>
      createIssueSchema.parse({ title: "Broken navbar", description: VALID_DESCRIPTION })
        .projectId === undefined,
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Issue model schema                                                      */
/* -------------------------------------------------------------------------- */

section("Issue schema", [
  {
    description: "accepts a problem with no project",
    test: () =>
      isValid(models.Issue, {
        workspaceId: objectId(),
        createdBy: objectId(),
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
      }),
  },
  {
    description: "accepts a problem attached to a project",
    test: () =>
      isValid(models.Issue, {
        workspaceId: objectId(),
        projectId: objectId(),
        createdBy: objectId(),
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
      }),
  },
  {
    description: "requires workspaceId, createdBy and title",
    test: async () =>
      !(await isValid(models.Issue, { title: "Valid title", description: VALID_DESCRIPTION })) &&
      !(await isValid(models.Issue, {
        workspaceId: objectId(),
        title: "Valid title",
        description: VALID_DESCRIPTION,
      })) &&
      !(await isValid(models.Issue, {
        workspaceId: objectId(),
        createdBy: objectId(),
        description: VALID_DESCRIPTION,
      })),
  },
  {
    description: "defaults status/priority/category/source on creation",
    test: () => {
      const issue = new models.Issue({});
      return (
        issue.status === "new" &&
        issue.priority === "medium" &&
        issue.category === "other" &&
        issue.source === "text"
      );
    },
  },
  {
    description: "leaves AI-owned fields empty until their tasks run",
    test: () => {
      const issue = new models.Issue({});
      return (
        issue.aiConfidence === null &&
        issue.estimatedMinutes === null &&
        issue.resolvedAt === null &&
        issue.projectId === null
      );
    },
  },
  {
    description: "rejects a description shorter than the model minimum",
    test: async () =>
      !(await isValid(models.Issue, {
        workspaceId: objectId(),
        createdBy: objectId(),
        title: "Valid title",
        description: "short",
      })),
  },
  {
    description: "rejects unknown category/status/priority/source values",
    test: async () =>
      !(await isValid(models.Issue, { title: "Valid title", category: "design" })) &&
      !(await isValid(models.Issue, { title: "Valid title", status: "done" })) &&
      !(await isValid(models.Issue, { title: "Valid title", priority: "urgent" })) &&
      !(await isValid(models.Issue, { title: "Valid title", source: "video" })),
  },
  {
    description: "stores references, not embedded documents",
    test: () => {
      const paths = models.Issue.schema.paths;
      return (
        paths.workspaceId?.instance === "ObjectId" &&
        paths.projectId?.instance === "ObjectId" &&
        paths.createdBy?.instance === "ObjectId"
      );
    },
  },
  {
    description: "json transform exposes `id` and hides `_id`",
    test: () => {
      const json = new models.Issue({
        workspaceId: objectId(),
        createdBy: objectId(),
        title: "Valid title",
        description: VALID_DESCRIPTION,
      }).toJSON() as unknown as Record<string, unknown>;
      return json.id !== undefined && json._id === undefined;
    },
  },
]);

section("Issue indexes", [
  {
    description: "workspaceId + createdAt",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+createdAt"),
  },
  {
    description: "workspaceId + status (+ createdAt)",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+status+createdAt"),
  },
  {
    description: "workspaceId + priority",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+priority"),
  },
  {
    description: "workspaceId + category",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+category"),
  },
  {
    description: "projectId + createdAt",
    test: () => indexNamesOf(models.Issue).includes("projectId+createdAt"),
  },
  {
    description: "createdBy + createdAt",
    test: () => indexNamesOf(models.Issue).includes("createdBy+createdAt"),
  },
  {
    description: "keeps the full-text index for issue search",
    test: () =>
      models.Issue.schema.indexes().some(([fields]) => Object.values(fields).includes("text")),
  },
  {
    description: "adds no index beyond the ones a current query needs",
    test: () => indexNamesOf(models.Issue).length === 7,
  },
]);

/* -------------------------------------------------------------------------- */
/* 6. Permissions                                                             */
/* -------------------------------------------------------------------------- */

section("Who can create problems", [
  {
    description: "owner can create problems",
    test: () => canCreateIssue("owner") === true,
  },
  {
    description: "admin can create problems",
    test: () => canCreateIssue("admin") === true,
  },
  {
    description: "member can create problems",
    test: () => canCreateIssue("member") === true,
  },
  {
    description: "non-members and unknown roles cannot",
    test: () => canCreateIssue(null) === false && canCreateIssue("superuser" as never) === false,
  },
  {
    description: "all three roles can view problems",
    test: () => canViewIssues("owner") && canViewIssues("admin") && canViewIssues("member"),
  },
]);

/* -------------------------------------------------------------------------- */
/* 7. Server-controlled document build                                        */
/* -------------------------------------------------------------------------- */

section("Server-controlled fields", [
  {
    description: "new problems are stored as status 'new', source 'text'",
    test: () => {
      const doc = buildIssueDocument({
        workspaceId: objectId().toString(),
        userId: objectId().toString(),
        projectId: null,
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "ui",
        priority: "high",
      });
      return doc.status === "new" && doc.source === "text";
    },
  },
  {
    description: "AI-owned fields and assignee stay empty on creation",
    test: () => {
      const doc = buildIssueDocument({
        workspaceId: objectId().toString(),
        userId: objectId().toString(),
        projectId: null,
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "other",
        priority: "medium",
      });
      return (
        doc.aiConfidence === null &&
        doc.estimatedMinutes === null &&
        doc.resolvedAt === null &&
        doc.assignedTo === null
      );
    },
  },
  {
    description: "workspaceId and createdBy come from the trusted arguments",
    test: () => {
      const workspaceId = objectId().toString();
      const userId = objectId().toString();
      const doc = buildIssueDocument({
        workspaceId,
        userId,
        projectId: null,
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "other",
        priority: "medium",
      });
      return String(doc.workspaceId) === workspaceId && String(doc.createdBy) === userId;
    },
  },
  {
    description: "projectId is stored as an ObjectId when provided, else null",
    test: () => {
      const projectId = objectId().toString();
      const withProject = buildIssueDocument({
        workspaceId: objectId().toString(),
        userId: objectId().toString(),
        projectId,
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "other",
        priority: "medium",
      });
      const withoutProject = buildIssueDocument({
        workspaceId: objectId().toString(),
        userId: objectId().toString(),
        projectId: null,
        title: "Mobile navbar is broken",
        description: VALID_DESCRIPTION,
        category: "other",
        priority: "medium",
      });
      return String(withProject.projectId) === projectId && withoutProject.projectId === null;
    },
  },
  {
    description: "writes exactly the creation fields — nothing a client could add",
    test: () =>
      Object.keys(
        buildIssueDocument({
          workspaceId: objectId().toString(),
          userId: objectId().toString(),
          projectId: null,
          title: "Mobile navbar is broken",
          description: VALID_DESCRIPTION,
          category: "other",
          priority: "medium",
        }),
      )
        .sort()
        .join(",") ===
      [
        "aiConfidence",
        "assignedTo",
        "category",
        "createdBy",
        "description",
        "estimatedMinutes",
        "priority",
        "projectId",
        "resolvedAt",
        "source",
        "status",
        "title",
        "workspaceId",
      ].join(","),
  },
]);

/* -------------------------------------------------------------------------- */
/* 8. Workspace & project authorization                                       */
/* -------------------------------------------------------------------------- */

section("Workspace authorization", [
  {
    description: "finds a member's membership in their own workspace",
    test: () => {
      const userId = objectId();
      const membership = findMembership(
        { members: [{ userId, role: "member", joinedAt: new Date() }] },
        String(userId),
      );
      return membership?.role === "member";
    },
  },
  {
    description: "returns no membership for a user outside the workspace",
    test: () =>
      findMembership(
        { members: [{ userId: objectId(), role: "owner", joinedAt: new Date() }] },
        objectId().toString(),
      ) === null,
  },
  {
    description: "an empty workspace grants nobody access",
    test: () => findMembership({ members: [] }, objectId().toString()) === null,
  },
]);

section("Project association authorization", [
  {
    description: "accepts a project that belongs to the workspace",
    test: () => {
      const workspaceId = objectId().toString();
      try {
        assertProjectInWorkspace({ workspaceId: new Types.ObjectId(workspaceId) }, workspaceId);
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    description: "rejects a project from another workspace with 403",
    test: () => {
      try {
        assertProjectInWorkspace({ workspaceId: objectId() }, objectId().toString());
        return false;
      } catch (error) {
        return error instanceof AppError && error.statusCode === 403;
      }
    },
  },
  {
    description: "rejects a project that does not exist with 403",
    test: () => {
      try {
        assertProjectInWorkspace(null, objectId().toString());
        return false;
      } catch (error) {
        return error instanceof AppError && error.statusCode === 403;
      }
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 9. Activity logging                                                        */
/* -------------------------------------------------------------------------- */

section("issue.created activity", [
  {
    description: "issue.created is a known activity action",
    test: () =>
      (ACTIVITY_ACTIONS as readonly string[]).includes("issue.created") &&
      ACTIVITY_ACTION_TYPES.ISSUE_CREATED === "issue.created",
  },
  {
    description: "metadata carries issueId, title and projectId only",
    test: () =>
      Object.keys(issueCreatedMetadata({ issueId: "a", title: "b", projectId: null }))
        .sort()
        .join(",") === "issueId,projectId,title",
  },
  {
    description: "never puts the description into activity metadata",
    test: () => {
      const metadata = issueCreatedMetadata({
        issueId: objectId().toString(),
        title: "Mobile navbar is broken",
        projectId: objectId().toString(),
      });
      return !("description" in metadata);
    },
  },
  {
    description: "survives metadata sanitization",
    test: () => {
      const sanitized = sanitizeMetadata(
        issueCreatedMetadata({ issueId: "id", title: "Title", projectId: "pid" }),
      );
      return (
        sanitized.issueId === "id" && sanitized.title === "Title" && sanitized.projectId === "pid"
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 10. Shared draft rules used by the form                                    */
/* -------------------------------------------------------------------------- */

section("Create form rules", [
  {
    description: "an empty draft reports both fields as required",
    test: () => {
      const errors = issueDraftErrors({ title: "", description: "" });
      return (
        errors.title === "Title is required." && errors.description === "Description is required."
      );
    },
  },
  {
    description: "a short title reports the minimum-length message",
    test: () =>
      issueDraftErrors({ title: "ab", description: VALID_DESCRIPTION }).title ===
      `Title must be at least ${ISSUE_TITLE_MIN_LENGTH} characters.`,
  },
  {
    description: "a short description reports the minimum-length message",
    test: () =>
      issueDraftErrors({ title: "Broken navbar", description: "short" }).description ===
      `Description must be at least ${ISSUE_DESCRIPTION_MIN_LENGTH} characters.`,
  },
  {
    description: "a valid draft reports no errors",
    test: () =>
      Object.keys(issueDraftErrors({ title: "Broken navbar", description: VALID_DESCRIPTION }))
        .length === 0,
  },
  {
    description: "every status has a human-readable label",
    test: () =>
      Object.values(ISSUE_STATUS_LABELS).every((label) => label.length > 0) &&
      issueStatusLabel("in_progress") === "In progress",
  },
]);

/* -------------------------------------------------------------------------- */
/* 11. Run the static suite                                                   */
/* -------------------------------------------------------------------------- */

let { passed, failed } = await harness.runCollecting();

/* -------------------------------------------------------------------------- */
/* 12. Live database checks (optional)                                        */
/* -------------------------------------------------------------------------- */

console.log("\nLive service checks");

if (!isDatabaseConfigured()) {
  console.log("  · skipped: set MONGODB_URI in .env.local to run the service-level checks");
  console.log(
    "    (creation per role, cross-workspace and cross-project rejection, activity, retrieval)",
  );
} else {
  console.log("  · running against the configured database");

  await connectToDatabase();

  const stamp = Date.now().toString(36);
  const owner = await models.User.create({ name: "Issue Owner", email: `owner-${stamp}@sp.test` });
  const admin = await models.User.create({ name: "Issue Admin", email: `admin-${stamp}@sp.test` });
  const member = await models.User.create({
    name: "Issue Member",
    email: `member-${stamp}@sp.test`,
  });
  const outsider = await models.User.create({
    name: "Issue Outsider",
    email: `outsider-${stamp}@sp.test`,
  });

  const workspaceA = await models.Workspace.create({
    name: "Issue Workspace A",
    slug: `issue-a-${stamp}`,
    ownerId: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: admin._id, role: "admin" },
      { userId: member._id, role: "member" },
    ],
  });

  const workspaceB = await models.Workspace.create({
    name: "Issue Workspace B",
    slug: `issue-b-${stamp}`,
    ownerId: outsider._id,
    members: [{ userId: outsider._id, role: "owner" }],
  });

  const projectA = await models.Project.create({
    workspaceId: workspaceA._id,
    name: "Website Redesign",
    createdBy: owner._id,
  });

  const projectB = await models.Project.create({
    workspaceId: workspaceB._id,
    name: "Client Portal",
    createdBy: outsider._id,
  });

  const liveHarness = new VerifyHarness();
  const createdIssueIds: string[] = [];

  liveHarness.section("Creation by role", [
    {
      description: "owner can create a problem (defaults: new / medium / text)",
      test: async () => {
        const issue = await createIssue(String(owner._id), String(workspaceA._id), {
          title: "Owner reported problem",
          description: VALID_DESCRIPTION,
        });
        createdIssueIds.push(issue.id);
        return (
          issue.status === "new" &&
          issue.priority === "medium" &&
          issue.source === "text" &&
          issue.category === "other" &&
          issue.projectId === null &&
          issue.aiConfidence === null &&
          issue.estimatedMinutes === null &&
          issue.resolvedAt === null &&
          issue.createdBy === String(owner._id) &&
          issue.workspaceId === String(workspaceA._id)
        );
      },
    },
    {
      description: "admin can create a problem with an explicit category and priority",
      test: async () => {
        const issue = await createIssue(String(admin._id), String(workspaceA._id), {
          title: "Admin reported problem",
          description: VALID_DESCRIPTION,
          category: "technical",
          priority: "critical",
        });
        createdIssueIds.push(issue.id);
        return (
          issue.category === "technical" &&
          issue.priority === "critical" &&
          issue.status === "new" &&
          issue.createdBy === String(admin._id)
        );
      },
    },
    {
      description: "member can create a problem",
      test: async () => {
        const issue = await createIssue(String(member._id), String(workspaceA._id), {
          title: "Member reported problem",
          description: VALID_DESCRIPTION,
        });
        createdIssueIds.push(issue.id);
        return issue.createdBy === String(member._id) && issue.status === "new";
      },
    },
  ]);

  liveHarness.section("Validation against the database", [
    {
      description: "a missing title is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              description: VALID_DESCRIPTION,
            }),
          )
        )?.statusCode === 400,
    },
    {
      description: "a short title is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "ab",
              description: VALID_DESCRIPTION,
            }),
          )
        )?.statusCode === 400,
    },
    {
      description: "a missing description is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), { title: "No description" }),
          )
        )?.statusCode === 400,
    },
    {
      description: "a short description is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "Short description",
              description: "too short",
            }),
          )
        )?.statusCode === 400,
    },
    {
      description: "an invalid category is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "Bad category",
              description: VALID_DESCRIPTION,
              category: "design",
            }),
          )
        )?.statusCode === 400,
    },
    {
      description: "an invalid priority is rejected",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "Bad priority",
              description: VALID_DESCRIPTION,
              priority: "urgent",
            }),
          )
        )?.statusCode === 400,
    },
    {
      description: "a malformed project id is rejected before any lookup",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "Bad project id",
              description: VALID_DESCRIPTION,
              projectId: "not-an-id",
            }),
          )
        )?.statusCode === 400,
    },
  ]);

  liveHarness.section("Project association", [
    {
      description: "a problem can be attached to a project of the same workspace",
      test: async () => {
        const issue = await createIssue(String(member._id), String(workspaceA._id), {
          title: "Contact form not working",
          description: VALID_DESCRIPTION,
          category: "ui",
          priority: "high",
          projectId: String(projectA._id),
        });
        createdIssueIds.push(issue.id);
        return issue.projectId === String(projectA._id) && issue.projectName === projectA.name;
      },
    },
    {
      description: "a project from another workspace is rejected with 403",
      test: async () =>
        (
          await thrown(() =>
            createIssue(String(owner._id), String(workspaceA._id), {
              title: "Cross-workspace project attempt",
              description: VALID_DESCRIPTION,
              projectId: String(projectB._id),
            }),
          )
        )?.statusCode === 403,
    },
    {
      description: "a rejected problem is not written to the database",
      test: async () =>
        (await models.Issue.countDocuments({
          workspaceId: workspaceA._id,
          title: "Cross-workspace project attempt",
        })) === 0,
    },
  ]);

  liveHarness.section("Workspace isolation", [
    {
      description: "a non-member cannot create a problem in the workspace",
      test: async () => {
        const error = await thrown(() =>
          createIssue(String(outsider._id), String(workspaceA._id), {
            title: "Outsider attempt",
            description: VALID_DESCRIPTION,
          }),
        );
        // The tenancy guard answers 404 for non-members so the endpoint cannot
        // be used to probe which workspaces exist.
        return error !== null && (error.statusCode === 404 || error.statusCode === 403);
      },
    },
    {
      description: "the rejected attempt wrote nothing",
      test: async () =>
        (await models.Issue.countDocuments({
          workspaceId: workspaceA._id,
          title: "Outsider attempt",
        })) === 0,
    },
    {
      description: "a forged workspaceId cannot be used by a member",
      test: async () =>
        (await thrown(() =>
          createIssue(String(member._id), String(workspaceB._id), {
            title: "Forged workspace attempt",
            description: VALID_DESCRIPTION,
          }),
        )) !== null,
    },
  ]);

  liveHarness.section("Retrieval", [
    {
      description: "a member can open a problem from their workspace",
      test: async () => {
        const issueId = createdIssueIds[0];
        if (!issueId) return false;
        const issue = await getIssueById(String(member._id), String(workspaceA._id), issueId);
        return issue.id === issueId && issue.description === VALID_DESCRIPTION;
      },
    },
    {
      description: "a non-member cannot open it",
      test: async () => {
        const issueId = createdIssueIds[0];
        if (!issueId) return false;
        return (
          (await thrown(() => getIssueById(String(outsider._id), String(workspaceA._id), issueId)))
            ?.statusCode === 404
        );
      },
    },
    {
      description: "the workspace list contains only its own problems",
      test: async () => {
        const [issuesA, issuesB] = await Promise.all([
          getWorkspaceIssues(String(member._id), String(workspaceA._id)),
          getWorkspaceIssues(String(outsider._id), String(workspaceB._id)),
        ]);
        return (
          issuesA.length >= 4 &&
          issuesA.every((issue) => issue.workspaceId === String(workspaceA._id)) &&
          issuesB.length === 0
        );
      },
    },
  ]);

  liveHarness.section("Activity log", [
    {
      description: "issue.created is recorded for a created problem",
      test: async () => {
        const issueId = createdIssueIds[0];
        if (!issueId) return false;
        const entry = await models.ActivityLog.findOne({
          workspaceId: workspaceA._id,
          action: "issue.created",
          issueId: new Types.ObjectId(issueId),
        }).lean();
        if (!entry) return false;
        const metadata = entry.metadata as Record<string, unknown>;
        return (
          metadata.issueId === issueId &&
          typeof metadata.title === "string" &&
          !("description" in metadata)
        );
      },
    },
    {
      description: "the project association appears in the activity metadata",
      test: async () => {
        const entry = await models.ActivityLog.findOne({
          workspaceId: workspaceA._id,
          action: "issue.created",
          "metadata.projectId": String(projectA._id),
        }).lean();
        return entry !== null;
      },
    },
  ]);

  const live = await liveHarness.runCollecting();
  passed += live.passed;
  failed += live.failed;

  // Fixtures are removed even when an assertion fails.
  await models.ActivityLog.deleteMany({
    workspaceId: { $in: [workspaceA._id, workspaceB._id] },
  });
  await models.Issue.deleteMany({ workspaceId: { $in: [workspaceA._id, workspaceB._id] } });
  await models.Project.deleteMany({ workspaceId: { $in: [workspaceA._id, workspaceB._id] } });
  await models.Workspace.deleteMany({ _id: { $in: [workspaceA._id, workspaceB._id] } });
  await models.User.deleteMany({
    _id: { $in: [owner._id, admin._id, member._id, outsider._id] },
  });
  await disconnectFromDatabase();
}

harness.report(passed, failed);
