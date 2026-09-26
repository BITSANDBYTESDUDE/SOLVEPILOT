/**
 * Problem (issue) verification tooling (Task 11 creation, Task 12 list).
 *
 * Static sections (no database needed) cover: field validation, the Issue schema
 * and its indexes, the permission matrix, the server-controlled document build,
 * workspace/project authorization decisions, activity metadata, the shared
 * label/draft rules the form uses, and — for the list — query validation, filter
 * construction, sort translation, pagination maths, search escaping and the
 * URL-state codec.
 *
 * The live section (only when MONGODB_URI is set) exercises the real service:
 * creation as owner/admin/member, defaults, cross-workspace rejection,
 * cross-project rejection, the `issue.created` activity record, retrieval
 * isolation, and search / filter / sort / pagination against a seeded data set.
 * Fixtures are created and removed by the script.
 *
 * Usage:  npm run issue:verify
 */
import { createRequire } from "node:module";

import { Types, type Model } from "mongoose";

import { findMembership } from "@/lib/auth/workspace";
import {
  ALL_FILTER,
  countActiveIssueFilters,
  DEFAULT_ISSUE_PAGE,
  DEFAULT_ISSUE_PAGE_SIZE,
  EMPTY_ISSUE_LIST_STATE,
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_DESCRIPTION_MIN_LENGTH,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_PRIORITY_WEIGHTS,
  ISSUE_SORTS,
  ISSUE_STATUS_LABELS,
  ISSUE_TITLE_MIN_LENGTH,
  issueCategoryLabel,
  issueDraftErrors,
  issueListQueryString,
  issueListStateFromParams,
  issueListStateToSearchParams,
  issueListViewFromQuery,
  issuePriorityLabel,
  issueStatusLabel,
  MAX_ISSUE_PAGE_SIZE,
  NO_PROJECT_FILTER,
} from "@/lib/constants/issues";
import { connectToDatabase, disconnectFromDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { AppError } from "@/lib/errors";
import * as models from "@/models";
import { sanitizeMetadata } from "@/services/activity.service";
import { escapeRegex, normalizeSearchTerm } from "@/lib/utils/search";
import {
  assertProjectInWorkspace,
  buildIssueDocument,
  buildIssueListFilter,
  buildIssuePagination,
  buildIssueSort,
  createIssue,
  getIssueById,
  getWorkspaceIssues,
  issueCreatedMetadata,
  issuePrioritySortStages,
  type IssueFilters,
} from "@/services/issue.service";
import { canCreateIssue, canViewIssues } from "@/services/permission.service";
import { ACTIVITY_ACTION_TYPES, ACTIVITY_ACTIONS, ISSUE_CATEGORIES } from "@/types/domain";
import {
  createIssueSchema,
  issueCategorySchema,
  issueDescriptionSchema,
  issueListQuerySchema,
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
    description: "workspaceId + priority + createdAt",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+priority+createdAt"),
  },
  {
    description: "workspaceId + category + createdAt",
    test: () => indexNamesOf(models.Issue).includes("workspaceId+category+createdAt"),
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
/* 11. List query validation (Task 12)                                        */
/* -------------------------------------------------------------------------- */

section("List query defaults", [
  {
    description: "defaults to page 1, limit 20, newest first",
    test: () => {
      const parsed = issueListQuerySchema.parse({});
      return (
        parsed.page === DEFAULT_ISSUE_PAGE &&
        parsed.limit === DEFAULT_ISSUE_PAGE_SIZE &&
        parsed.sort === "created_desc" &&
        parsed.search === undefined &&
        parsed.status === undefined &&
        parsed.priority === undefined &&
        parsed.category === undefined &&
        parsed.projectId === undefined
      );
    },
  },
  {
    description: "accepts a custom page and limit (as strings, like a query string)",
    test: () => {
      const parsed = issueListQuerySchema.parse({ page: "3", limit: "50" });
      return parsed.page === 3 && parsed.limit === 50;
    },
  },
  {
    description: `accepts the maximum limit of ${MAX_ISSUE_PAGE_SIZE}`,
    test: () =>
      issueListQuerySchema.parse({ limit: String(MAX_ISSUE_PAGE_SIZE) }).limit ===
      MAX_ISSUE_PAGE_SIZE,
  },
  {
    description: "rejects limit=5000 instead of returning 5000 records",
    test: () => !issueListQuerySchema.safeParse({ limit: "5000" }).success,
  },
  {
    description: "rejects page 0 and negative pages",
    test: () =>
      !issueListQuerySchema.safeParse({ page: "0" }).success &&
      !issueListQuerySchema.safeParse({ page: "-2" }).success,
  },
  {
    description: "rejects non-numeric page and limit",
    test: () =>
      !issueListQuerySchema.safeParse({ page: "abc" }).success &&
      !issueListQuerySchema.safeParse({ limit: "many" }).success,
  },
  {
    description: "treats blank parameters as absent",
    test: () => {
      const parsed = issueListQuerySchema.parse({ page: "", limit: "", search: "", sort: "" });
      return parsed.page === 1 && parsed.limit === 20 && parsed.sort === "created_desc";
    },
  },
  {
    description: "ignores parameters it does not know",
    test: () => {
      const parsed = issueListQuerySchema.parse({ search: "navbar", evil: "yes" }) as Record<
        string,
        unknown
      >;
      return !("evil" in parsed);
    },
  },
]);

section("List filter validation", [
  {
    description: "accepts every status, including in_progress",
    test: () =>
      ["new", "analyzing", "planned", "in_progress", "verification", "resolved", "closed"].every(
        (status) => issueListQuerySchema.safeParse({ status }).success,
      ),
  },
  {
    description: "accepts every priority and category",
    test: () =>
      ["low", "medium", "high", "critical"].every(
        (priority) => issueListQuerySchema.safeParse({ priority }).success,
      ) &&
      ["technical", "ui", "business", "productivity", "academic", "other"].every(
        (category) => issueListQuerySchema.safeParse({ category }).success,
      ),
  },
  {
    description: "rejects unknown filter values",
    test: () =>
      !issueListQuerySchema.safeParse({ status: "done" }).success &&
      !issueListQuerySchema.safeParse({ priority: "urgent" }).success &&
      !issueListQuerySchema.safeParse({ category: "design" }).success &&
      !issueListQuerySchema.safeParse({ sort: "title" }).success,
  },
  {
    description: "treats 'all' as no filter",
    test: () => {
      const parsed = issueListQuerySchema.parse({
        status: "all",
        priority: "all",
        category: "all",
        projectId: "all",
      });
      return (
        parsed.status === undefined &&
        parsed.priority === undefined &&
        parsed.category === undefined &&
        parsed.projectId === undefined
      );
    },
  },
  {
    description: "accepts a project id or the 'none' sentinel, rejects anything else",
    test: () => {
      const id = objectId().toString();
      return (
        issueListQuerySchema.parse({ projectId: id }).projectId === id &&
        issueListQuerySchema.parse({ projectId: NO_PROJECT_FILTER }).projectId ===
          NO_PROJECT_FILTER &&
        !issueListQuerySchema.safeParse({ projectId: "not-an-id" }).success
      );
    },
  },
  {
    description: "rejects query-operator injection in place of a value",
    test: () =>
      !issueListQuerySchema.safeParse({ status: { $ne: null } }).success &&
      !issueListQuerySchema.safeParse({ priority: { $in: ["low", "high"] } }).success &&
      !issueListQuerySchema.safeParse({ projectId: { $where: "1" } }).success,
  },
  {
    description: "trims the search term and caps its length",
    test: () =>
      issueListQuerySchema.parse({ search: "  navbar  " }).search === "navbar" &&
      issueListQuerySchema.parse({ search: "" }).search === undefined &&
      !issueListQuerySchema.safeParse({ search: "a".repeat(101) }).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 12. Search safety                                                          */
/* -------------------------------------------------------------------------- */

section("Search safety", [
  {
    description: "escapes regular-expression metacharacters",
    test: () => escapeRegex("a.b*c") === "a\\.b\\*c",
  },
  {
    description: "an escaped term matches literally, not as a pattern",
    test: () => new RegExp(escapeRegex("button.*"), "i").test("Button alignment") === false,
  },
  {
    description: "a hostile pattern cannot become an expensive expression",
    test: () => {
      const escaped = escapeRegex("(a+)+$");
      return escaped.includes("\\(") && new RegExp(escaped, "i").test("(a+)+$") === true;
    },
  },
  {
    description: "normalizes whitespace and drops empty terms",
    test: () =>
      normalizeSearchTerm("  mobile   navbar ") === "mobile navbar" &&
      normalizeSearchTerm("") === undefined &&
      normalizeSearchTerm("    ") === undefined &&
      normalizeSearchTerm(null) === undefined &&
      normalizeSearchTerm(42) === undefined,
  },
  {
    description: "drops terms longer than the maximum",
    test: () => normalizeSearchTerm("a".repeat(101)) === undefined,
  },
]);

/* -------------------------------------------------------------------------- */
/* 13. Filter construction                                                    */
/* -------------------------------------------------------------------------- */

const workspaceIdForFilter = objectId().toString();

section("List filter construction", [
  {
    description: "an unfiltered list is still scoped to the workspace",
    test: () => {
      const filter = buildIssueListFilter(workspaceIdForFilter, {});
      return (
        Object.keys(filter).length === 1 && String(filter.workspaceId) === workspaceIdForFilter
      );
    },
  },
  {
    description: "a forged workspaceId in the filters cannot override the tenant",
    test: () => {
      const forged = { workspaceId: objectId().toString() } as unknown as IssueFilters;
      const filter = buildIssueListFilter(workspaceIdForFilter, forged);
      return String(filter.workspaceId) === workspaceIdForFilter;
    },
  },
  {
    description: "search becomes an escaped, case-insensitive match on title and description",
    test: () => {
      const filter = buildIssueListFilter(workspaceIdForFilter, { search: "Navbar!" });
      const clauses = filter.$or as Array<Record<string, { $regex: string; $options: string }>>;
      return (
        Array.isArray(clauses) &&
        clauses.length === 2 &&
        clauses.every(
          (clause) =>
            Object.values(clause)[0]?.$options === "i" &&
            Object.values(clause)[0]?.$regex === "Navbar!",
        )
      );
    },
  },
  {
    description: "regex metacharacters in a search term stay literal",
    test: () => {
      const filter = buildIssueListFilter(workspaceIdForFilter, { search: "button.*" });
      const clauses = filter.$or as Array<Record<string, { $regex: string }>>;
      const pattern = clauses[0] && Object.values(clauses[0])[0]?.$regex;
      return (
        typeof pattern === "string" && new RegExp(pattern, "i").test("Button alignment") === false
      );
    },
  },
  {
    description: "status, priority and category become equality matches",
    test: () => {
      const filter = buildIssueListFilter(workspaceIdForFilter, {
        status: "in_progress",
        priority: "critical",
        category: "technical",
      });
      return (
        filter.status === "in_progress" &&
        filter.priority === "critical" &&
        filter.category === "technical"
      );
    },
  },
  {
    description: "'none' selects problems with no project",
    test: () =>
      buildIssueListFilter(workspaceIdForFilter, { projectId: NO_PROJECT_FILTER }).projectId ===
      null,
  },
  {
    description: "a project id becomes an ObjectId",
    test: () => {
      const projectId = objectId().toString();
      const value = buildIssueListFilter(workspaceIdForFilter, { projectId }).projectId;
      return value instanceof Types.ObjectId && String(value) === projectId;
    },
  },
  {
    description: "a malformed project id is dropped rather than queried",
    test: () =>
      !("projectId" in buildIssueListFilter(workspaceIdForFilter, { projectId: "garbage" })),
  },
  {
    description: "a combined query keeps every narrowing",
    test: () => {
      const projectId = objectId().toString();
      const filter = buildIssueListFilter(workspaceIdForFilter, {
        search: "navbar",
        status: "new",
        priority: "high",
        category: "ui",
        projectId,
      });
      return (
        Object.keys(filter).sort().join(",") ===
        "$or,category,priority,projectId,status,workspaceId"
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 14. Sorting                                                                */
/* -------------------------------------------------------------------------- */

section("List sorting", [
  {
    description: "newest / oldest sort by createdAt",
    test: () =>
      buildIssueSort("created_desc").sort?.createdAt === -1 &&
      buildIssueSort("created_asc").sort?.createdAt === 1,
  },
  {
    description: "recently updated sorts by updatedAt",
    test: () => buildIssueSort("updated_desc").sort?.updatedAt === -1,
  },
  {
    description: "title sorts A→Z and Z→A",
    test: () =>
      buildIssueSort("title_asc").sort?.title === 1 &&
      buildIssueSort("title_desc").sort?.title === -1,
  },
  {
    description: "every stored-field sort carries an _id tie-breaker for stable pages",
    test: () =>
      (["created_desc", "created_asc", "updated_desc", "title_asc", "title_desc"] as const).every(
        (sort) => buildIssueSort(sort).sort?._id !== undefined,
      ),
  },
  {
    description: "priority sorts are computed in the query, not sorted alphabetically",
    test: () =>
      buildIssueSort("priority_desc").sort === null &&
      buildIssueSort("priority_desc").priorityDirection === -1 &&
      buildIssueSort("priority_asc").priorityDirection === 1,
  },
  {
    description: "priority ranks follow the product weights (critical 4 … low 1)",
    test: () => {
      const stages = issuePrioritySortStages(-1);
      const sortStage = stages[1] as { $sort: Record<string, number> };
      const addFields = JSON.stringify(stages[0]) as string;
      return (
        ISSUE_PRIORITY_WEIGHTS.critical === 4 &&
        ISSUE_PRIORITY_WEIGHTS.high === 3 &&
        ISSUE_PRIORITY_WEIGHTS.medium === 2 &&
        ISSUE_PRIORITY_WEIGHTS.low === 1 &&
        sortStage.$sort.priorityRank === -1 &&
        addFields.includes('"$switch"') &&
        issuePrioritySortStages(1)[1] !== undefined
      );
    },
  },
  {
    description: "every supported sort key is accepted by the API",
    test: () => ISSUE_SORTS.every((sort) => issueListQuerySchema.safeParse({ sort }).success),
  },
]);

/* -------------------------------------------------------------------------- */
/* 15. Pagination                                                             */
/* -------------------------------------------------------------------------- */

section("Pagination maths", [
  {
    description: "an empty result set still reports one page",
    test: () => {
      const pagination = buildIssuePagination(1, 20, 0);
      return (
        pagination.total === 0 &&
        pagination.totalPages === 1 &&
        pagination.hasNextPage === false &&
        pagination.hasPreviousPage === false
      );
    },
  },
  {
    description: "75 problems at 20 per page is 4 pages",
    test: () => {
      const pagination = buildIssuePagination(1, 20, 75);
      return (
        pagination.totalPages === 4 &&
        pagination.hasNextPage === true &&
        pagination.hasPreviousPage === false
      );
    },
  },
  {
    description: "the last page has no next page",
    test: () => {
      const pagination = buildIssuePagination(4, 20, 75);
      return pagination.hasNextPage === false && pagination.hasPreviousPage === true;
    },
  },
  {
    description: "a middle page has both neighbours",
    test: () => {
      const pagination = buildIssuePagination(2, 20, 75);
      return pagination.hasNextPage === true && pagination.hasPreviousPage === true;
    },
  },
  {
    description: "an exact multiple needs no extra page",
    test: () => buildIssuePagination(1, 20, 40).totalPages === 2,
  },
]);

/* -------------------------------------------------------------------------- */
/* 16. URL state                                                              */
/* -------------------------------------------------------------------------- */

section("List URL state", [
  {
    description: "the default state produces no query string",
    test: () => issueListStateToSearchParams(EMPTY_ISSUE_LIST_STATE).toString() === "",
  },
  {
    description: "a narrowed state round-trips through the URL",
    test: () => {
      const projectId = objectId().toString();
      const state = {
        search: "navbar",
        status: "new" as const,
        priority: "high" as const,
        category: "ui" as const,
        projectId,
        sort: "priority_desc" as const,
        page: 2,
      };
      const params = issueListStateToSearchParams(state);
      const restored = issueListStateFromParams(params);
      return (
        restored.search === "navbar" &&
        restored.status === "new" &&
        restored.priority === "high" &&
        restored.category === "ui" &&
        restored.projectId === projectId &&
        restored.sort === "priority_desc" &&
        restored.page === 2
      );
    },
  },
  {
    description: "unknown values in a shared link fall back to defaults",
    test: () => {
      const state = issueListStateFromParams({
        status: "done",
        sort: "nope",
        page: "-3",
        category: "design",
      });
      return (
        state.status === ALL_FILTER &&
        state.sort === "created_desc" &&
        state.page === 1 &&
        state.category === ALL_FILTER
      );
    },
  },
  {
    description: "counts the active filters",
    test: () =>
      countActiveIssueFilters(EMPTY_ISSUE_LIST_STATE) === 0 &&
      countActiveIssueFilters({
        ...EMPTY_ISSUE_LIST_STATE,
        search: "x",
        status: "new",
        projectId: NO_PROJECT_FILTER,
      }) === 3,
  },
  {
    description: "builds a shareable path",
    test: () =>
      issueListQueryString(EMPTY_ISSUE_LIST_STATE) === "/dashboard/issues" &&
      issueListQueryString({ ...EMPTY_ISSUE_LIST_STATE, search: "navbar", page: 2 }) ===
        "/dashboard/issues?search=navbar&page=2",
  },
  {
    description: "a normalized service query maps back onto the controls",
    test: () => {
      const view = issueListViewFromQuery({ sort: "created_desc", page: 1 });
      return (
        view.search === "" &&
        view.status === ALL_FILTER &&
        view.priority === ALL_FILTER &&
        view.category === ALL_FILTER &&
        view.projectId === ALL_FILTER
      );
    },
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
    "    (creation per role, cross-workspace and cross-project rejection, activity, retrieval,",
  );
  console.log("     plus search, filters, sorting, pagination and isolation over seeded data)");
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

  const projectA2 = await models.Project.create({
    workspaceId: workspaceA._id,
    name: "Mobile App",
    createdBy: owner._id,
  });

  const liveHarness = new VerifyHarness();
  const createdIssueIds: string[] = [];

  /**
   * A deterministic data set for the list checks (Task 12).
   *
   * Written straight to the collection so the assertions can rely on exact
   * priorities, statuses, projects and timestamps — the service always creates
   * problems as `new` / `text`, which would make every ordering test identical.
   */
  const day = 24 * 60 * 60 * 1000;
  const seededAt = Date.now() - 10 * day;
  const seedSpecs = [
    {
      key: "navbar",
      title: "Mobile navbar broken",
      description: "The navigation menu overflows the viewport on phones.",
      priority: "high" as const,
      status: "new" as const,
      category: "ui" as const,
      projectId: projectA._id,
      age: 5,
    },
    {
      key: "login",
      title: "Login redirect issue",
      description: "Users land in a redirect loop after signing in.",
      priority: "critical" as const,
      status: "planned" as const,
      category: "technical" as const,
      projectId: projectA2._id,
      age: 4,
    },
    {
      key: "button",
      title: "Button alignment",
      description: "Buttons overlap on small screens.",
      priority: "medium" as const,
      status: "resolved" as const,
      category: "ui" as const,
      projectId: projectA._id,
      age: 3,
    },
    {
      key: "export",
      title: "Export report timeout",
      description: "The export never finishes for large workspaces.",
      priority: "low" as const,
      status: "new" as const,
      category: "technical" as const,
      projectId: null,
      age: 2,
    },
    {
      key: "email",
      title: "Onboarding email wording",
      description: "There is a typo in the welcome email.",
      priority: "medium" as const,
      status: "closed" as const,
      category: "business" as const,
      projectId: null,
      age: 1,
    },
  ];

  const seeded: Record<string, Types.ObjectId> = {};
  for (const spec of seedSpecs) {
    const createdAt = new Date(seededAt + spec.age * day);
    const doc = await models.Issue.create({
      workspaceId: workspaceA._id,
      projectId: spec.projectId,
      createdBy: member._id,
      title: spec.title,
      description: spec.description,
      category: spec.category,
      status: spec.status,
      priority: spec.priority,
      source: "text",
      createdAt,
      updatedAt: createdAt,
    });
    if (spec.key) seeded[spec.key] = doc._id as Types.ObjectId;
  }

  const idOf = (key: string) => String(seeded[key] ?? "");

  /** Titles in the order the list returned them. */
  const titlesOf = (issues: Array<{ id: string; title: string }>, keys: string[]) =>
    issues.map((issue) => keys.find((key) => idOf(key) === issue.id) ?? issue.title);

  const listAs = (
    query: Record<string, unknown> = {},
    as: Types.ObjectId = member._id,
    workspace: Types.ObjectId = workspaceA._id,
  ) => getWorkspaceIssues(String(as), String(workspace), query);

  liveHarness.section("List: pagination", [
    {
      description: "defaults to page 1 with 20 per page, newest first",
      test: async () => {
        const result = await listAs({});
        return (
          result.pagination.page === 1 &&
          result.pagination.limit === 20 &&
          result.pagination.total === 5 &&
          result.pagination.totalPages === 1 &&
          result.pagination.hasNextPage === false &&
          result.pagination.hasPreviousPage === false &&
          titlesOf(result.issues, ["email", "export", "button", "login", "navbar"]).join(",") ===
            "email,export,button,login,navbar"
        );
      },
    },
    {
      description: "honours a custom page and limit",
      test: async () => {
        const page1 = await listAs({ page: 1, limit: 2 });
        const page2 = await listAs({ page: 2, limit: 2 });
        const page3 = await listAs({ page: 3, limit: 2 });
        return (
          page1.pagination.total === 5 &&
          page1.pagination.totalPages === 3 &&
          page1.pagination.hasNextPage === true &&
          titlesOf(page1.issues, ["email", "export"]).join(",") === "email,export" &&
          titlesOf(page2.issues, ["button", "login"]).join(",") === "button,login" &&
          page2.pagination.hasPreviousPage === true &&
          page3.issues.length === 1 &&
          page3.pagination.hasNextPage === false
        );
      },
    },
    {
      description: "never returns more than the maximum page size",
      test: async () => {
        const result = await listAs({ limit: 100 });
        return result.pagination.limit === 100 && result.issues.length <= 100;
      },
    },
    {
      description: "rejects limit=5000 and page=0",
      test: async () =>
        (await thrown(() => listAs({ limit: 5000 })))?.statusCode === 400 &&
        (await thrown(() => listAs({ page: 0 })))?.statusCode === 400,
    },
  ]);

  liveHarness.section("List: search", [
    {
      description: "finds a match in the title",
      test: async () => {
        const result = await listAs({ search: "navbar" });
        return result.pagination.total === 1 && result.issues[0]?.id === idOf("navbar");
      },
    },
    {
      description: "finds a match in the description",
      test: async () => {
        const result = await listAs({ search: "welcome email" });
        return result.pagination.total === 1 && result.issues[0]?.id === idOf("email");
      },
    },
    {
      description: "is case-insensitive",
      test: async () =>
        (await listAs({ search: "NAVBAR" })).pagination.total === 1 &&
        (await listAs({ search: "Button ALIGNMENT" })).pagination.total === 1,
    },
    {
      description: "an empty search returns everything",
      test: async () => (await listAs({ search: "" })).pagination.total === 5,
    },
    {
      description: "regex metacharacters are matched literally, not as a pattern",
      test: async () => (await listAs({ search: "button.*" })).pagination.total === 0,
    },
    {
      description: "a search with no matches reports zero results",
      test: async () => {
        const result = await listAs({ search: "zzz-no-such-problem" });
        return result.pagination.total === 0 && result.issues.length === 0;
      },
    },
  ]);

  liveHarness.section("List: filters", [
    {
      description: "filters by status",
      test: async () => {
        const result = await listAs({ status: "new" });
        return (
          result.pagination.total === 2 && result.issues.every((issue) => issue.status === "new")
        );
      },
    },
    {
      description: "filters by priority",
      test: async () => {
        const result = await listAs({ priority: "critical" });
        return result.pagination.total === 1 && result.issues[0]?.id === idOf("login");
      },
    },
    {
      description: "filters by category",
      test: async () => {
        const result = await listAs({ category: "ui" });
        return (
          result.pagination.total === 2 && result.issues.every((issue) => issue.category === "ui")
        );
      },
    },
    {
      description: "filters by project",
      test: async () => {
        const inProjectA = await listAs({ projectId: String(projectA._id) });
        const inProjectA2 = await listAs({ projectId: String(projectA2._id) });
        return (
          inProjectA.pagination.total === 2 &&
          inProjectA.issues.every((issue) => issue.projectId === String(projectA._id)) &&
          inProjectA2.pagination.total === 1 &&
          inProjectA2.issues[0]?.id === idOf("login")
        );
      },
    },
    {
      description: "filters problems that have no project",
      test: async () => {
        const result = await listAs({ projectId: "none" });
        return (
          result.pagination.total === 2 && result.issues.every((issue) => issue.projectId === null)
        );
      },
    },
    {
      description: "rejects a project from another workspace as a filter",
      test: async () =>
        (await thrown(() => listAs({ projectId: String(projectB._id) })))?.statusCode === 403,
    },
    {
      description: "rejects an unknown status value",
      test: async () => (await thrown(() => listAs({ status: "done" })))?.statusCode === 400,
    },
  ]);

  liveHarness.section("List: sorting", [
    {
      description: "oldest first reverses newest first",
      test: async () => {
        const oldest = await listAs({ sort: "created_asc" });
        return (
          titlesOf(oldest.issues, ["navbar", "login", "button", "export", "email"]).join(",") ===
          "navbar,login,button,export,email"
        );
      },
    },
    {
      description: "recently updated puts the touched problem first",
      test: async () => {
        await models.Issue.updateOne({ _id: seeded.navbar }, { $set: { status: "new" } });
        const result = await listAs({ sort: "updated_desc" });
        return result.issues[0]?.id === idOf("navbar");
      },
    },
    {
      description: "priority high → low orders by weight, not alphabetically",
      test: async () => {
        const result = await listAs({ sort: "priority_desc" });
        const priorities = result.issues.map((issue) => issue.priority);
        return (
          priorities[0] === "critical" &&
          priorities[1] === "high" &&
          priorities[priorities.length - 1] === "low"
        );
      },
    },
    {
      description: "priority low → high reverses it",
      test: async () => {
        const result = await listAs({ sort: "priority_asc" });
        const priorities = result.issues.map((issue) => issue.priority);
        return priorities[0] === "low" && priorities[priorities.length - 1] === "critical";
      },
    },
    {
      description: "title A→Z and Z→A",
      test: async () => {
        const ascending = await listAs({ sort: "title_asc" });
        const descending = await listAs({ sort: "title_desc" });
        return (
          ascending.issues[0]?.id === idOf("button") && descending.issues[0]?.id === idOf("email")
        );
      },
    },
  ]);

  liveHarness.section("List: combined queries and isolation", [
    {
      description: "search + status + category + project + sort + pagination together",
      test: async () => {
        const result = await listAs({
          search: "report",
          status: "new",
          category: "technical",
          projectId: "none",
          sort: "created_desc",
          page: 1,
          limit: 10,
        });
        return result.pagination.total === 1 && result.issues[0]?.id === idOf("export");
      },
    },
    {
      description: "filters that match nothing return an empty page, not an error",
      test: async () => {
        const result = await listAs({ status: "verification", priority: "critical" });
        return result.pagination.total === 0 && result.issues.length === 0;
      },
    },
    {
      description: "a non-member cannot list another workspace's problems",
      test: async () => (await thrown(() => listAs({}, outsider._id, workspaceA._id))) !== null,
    },
    {
      description: "a member only ever sees their own workspace's problems",
      test: async () => {
        const result = await listAs({}, member._id, workspaceA._id);
        return result.issues.every((issue) => issue.workspaceId === String(workspaceA._id));
      },
    },
    {
      description: "a workspace with no problems reports an empty page",
      test: async () => {
        const result = await listAs({}, outsider._id, workspaceB._id);
        return result.pagination.total === 0 && result.issues.length === 0;
      },
    },
    {
      description: "a problem from another workspace cannot be opened by id",
      test: async () =>
        (
          await thrown(() =>
            getIssueById(String(outsider._id), String(workspaceB._id), idOf("navbar")),
          )
        )?.statusCode === 404,
    },
  ]);

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
        const [listA, listB] = await Promise.all([
          getWorkspaceIssues(String(member._id), String(workspaceA._id)),
          getWorkspaceIssues(String(outsider._id), String(workspaceB._id)),
        ]);
        return (
          listA.issues.length >= 4 &&
          listA.issues.every((issue) => issue.workspaceId === String(workspaceA._id)) &&
          listB.issues.length === 0 &&
          listB.pagination.total === 0
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
