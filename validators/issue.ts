import { Types } from "mongoose";
import { z } from "zod";

import {
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  ISSUE_DESCRIPTION_MAX_LENGTH,
  ISSUE_DESCRIPTION_MESSAGES,
  ISSUE_DESCRIPTION_MIN_LENGTH,
  ISSUE_TITLE_MAX_LENGTH,
  ISSUE_TITLE_MESSAGES,
  ISSUE_TITLE_MIN_LENGTH,
} from "@/lib/constants/issues";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES } from "@/types/domain";

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
