import { Types } from "mongoose";
import { z } from "zod";

import {
  ALL_FILTER,
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  DEFAULT_ISSUE_PAGE,
  DEFAULT_ISSUE_PAGE_SIZE,
  DEFAULT_ISSUE_SORT,
  ISSUE_DESCRIPTION_MAX_LENGTH,
  ISSUE_DESCRIPTION_MESSAGES,
  ISSUE_DESCRIPTION_MIN_LENGTH,
  ISSUE_SORTS,
  ISSUE_TITLE_MAX_LENGTH,
  ISSUE_TITLE_MESSAGES,
  ISSUE_TITLE_MIN_LENGTH,
  MAX_ISSUE_PAGE_SIZE,
  NO_PROJECT_FILTER,
} from "@/lib/constants/issues";
import { MAX_SEARCH_TERM_LENGTH } from "@/lib/utils/search";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, ISSUE_STATUSES } from "@/types/domain";

/**
 * Problem (issue) validation schemas (Task 11).
 *
 * Rules align with `models/issue.model.ts` and with `lib/constants/issues.ts`,
 * which the create form reads so the browser and the server agree:
 * - Titles: 3–200 characters, trimmed.
 * - Descriptions: 10–10,000 characters, trimmed.
 * - Category/priority: strict enums with product defaults.
 * - Project id: optional, but must be a well-formed ObjectId *before* it is ever
 *   used in a database query.
 *
 * Only the fields a user may choose are parsed here. `workspaceId`, `createdBy`,
 * `status`, `source`, `aiConfidence`, `estimatedMinutes` and `resolvedAt` are
 * deliberately absent, and `z.object()` strips unknown keys, so a client that
 * sends them cannot influence the stored document.
 */

export {
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  ISSUE_DESCRIPTION_MAX_LENGTH,
  ISSUE_DESCRIPTION_MIN_LENGTH,
  ISSUE_TITLE_MAX_LENGTH,
  ISSUE_TITLE_MIN_LENGTH,
};

export const issueTitleSchema = z
  .string({ message: ISSUE_TITLE_MESSAGES.required })
  .trim()
  .min(ISSUE_TITLE_MIN_LENGTH, ISSUE_TITLE_MESSAGES.tooShort)
  .max(ISSUE_TITLE_MAX_LENGTH, ISSUE_TITLE_MESSAGES.tooLong);

export const issueDescriptionSchema = z
  .string({ message: ISSUE_DESCRIPTION_MESSAGES.required })
  .trim()
  .min(ISSUE_DESCRIPTION_MIN_LENGTH, ISSUE_DESCRIPTION_MESSAGES.tooShort)
  .max(ISSUE_DESCRIPTION_MAX_LENGTH, ISSUE_DESCRIPTION_MESSAGES.tooLong);

export const issueCategorySchema = z.enum(ISSUE_CATEGORIES, {
  message: "Choose a valid category.",
});

export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES, {
  message: "Choose a valid priority.",
});

/**
 * Optional project association.
 *
 * The form posts `""` (or `"none"`) for "No Project"; both mean "no association".
 * Anything else must already be a valid ObjectId, so a malformed id fails
 * validation instead of reaching `Project.findOne()`.
 */
export const issueProjectIdSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" && ["", "none"].includes(value.trim().toLowerCase())) {
      return undefined;
    }
    return value;
  },
  z
    .string({ message: "Select a valid project." })
    .refine((value) => Types.ObjectId.isValid(value), { message: "Select a valid project." })
    .optional(),
);

export const createIssueSchema = z.object({
  title: issueTitleSchema,
  description: issueDescriptionSchema,
  category: issueCategorySchema.default(DEFAULT_ISSUE_CATEGORY),
  priority: issuePrioritySchema.default(DEFAULT_ISSUE_PRIORITY),
  projectId: issueProjectIdSchema,
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

/**
 * Fields only the server may set.
 *
 * Nothing reads this list at runtime — it documents the boundary and backs the
 * assertion that a forged body cannot carry any of them.
 */
export const SERVER_CONTROLLED_ISSUE_FIELDS = [
  "workspaceId",
  "createdBy",
  "assignedTo",
  "status",
  "source",
  "aiConfidence",
  "estimatedMinutes",
  "resolvedAt",
  "createdAt",
  "updatedAt",
] as const;

/* -------------------------------------------------------------------------- */
/* List query (Task 12)                                                        */
/* -------------------------------------------------------------------------- */

/** Blank and `"all"` both mean "no filter applied". */
function blankOrAll(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return ["", ALL_FILTER].includes(value.trim().toLowerCase()) ? undefined : value;
}

/** Blank means "use the default" rather than "coerce to 0 and fail". */
function blank(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const issueStatusSchema = z.enum(ISSUE_STATUSES, {
  message: "Choose a valid status.",
});

export const issueSortSchema = z.enum(ISSUE_SORTS, {
  message: "Choose a valid sort order.",
});

/**
 * Search term: trimmed, length-bounded.
 *
 * Escaping happens where the term becomes a query (see `lib/utils/search.ts`),
 * so a term can never turn into regex operators.
 */
export const issueSearchSchema = z.preprocess(
  blank,
  z
    .string({ message: "Search must be text." })
    .trim()
    .max(MAX_SEARCH_TERM_LENGTH, `Search must be ${MAX_SEARCH_TERM_LENGTH} characters or fewer.`)
    .optional(),
);

export const issueStatusFilterSchema = z.preprocess(blankOrAll, issueStatusSchema.optional());

export const issuePriorityFilterSchema = z.preprocess(blankOrAll, issuePrioritySchema.optional());

export const issueCategoryFilterSchema = z.preprocess(blankOrAll, issueCategorySchema.optional());

/**
 * Project filter: an ObjectId, or `"none"` for problems with no project.
 *
 * The id is format-checked here and ownership-checked in the service, so a
 * project from another workspace can never be used as a filter.
 */
export const issueProjectFilterSchema = z.preprocess(
  blankOrAll,
  z
    .string({ message: "Select a valid project." })
    .refine(
      (value) => value === NO_PROJECT_FILTER || Types.ObjectId.isValid(value),
      "Select a valid project.",
    )
    .optional(),
);

export const issuePageSchema = z.preprocess(
  blank,
  z.coerce
    .number({ message: "Page must be a number." })
    .int("Page must be a whole number.")
    .min(1, "Page must be at least 1.")
    .default(DEFAULT_ISSUE_PAGE),
);

/**
 * Page size. Values above the maximum are rejected rather than silently
 * truncated, matching `activityQuerySchema`: a client asking for 5,000 records
 * has a bug, and guessing what it meant hides it.
 */
export const issueLimitSchema = z.preprocess(
  blank,
  z.coerce
    .number({ message: "Limit must be a number." })
    .int("Limit must be a whole number.")
    .min(1, "Limit must be at least 1.")
    .max(MAX_ISSUE_PAGE_SIZE, `Limit cannot exceed ${MAX_ISSUE_PAGE_SIZE}.`)
    .default(DEFAULT_ISSUE_PAGE_SIZE),
);

export const issueListQuerySchema = z.object({
  search: issueSearchSchema,
  status: issueStatusFilterSchema,
  priority: issuePriorityFilterSchema,
  category: issueCategoryFilterSchema,
  projectId: issueProjectFilterSchema,
  sort: z.preprocess(blank, issueSortSchema.default(DEFAULT_ISSUE_SORT)),
  page: issuePageSchema,
  limit: issueLimitSchema,
});

export type IssueListQuery = z.infer<typeof issueListQuerySchema>;
