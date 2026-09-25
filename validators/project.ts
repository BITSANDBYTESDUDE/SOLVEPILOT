import { Types } from "mongoose";
import { z } from "zod";

import { PROJECT_STATUSES, type ProjectStatus } from "@/types/domain";

/**
 * Project validation schemas (Task 08).
 *
 * Rules align with `models/project.model.ts`:
 * - Names: 2–120 characters, trimmed.
 * - Descriptions: up to 2000 characters.
 * - Colors: hex strings (3 or 6 hex digits with a leading `#`).
 * - Status: strictly "active" | "archived".
 */

export const PROJECT_NAME_MIN_LENGTH = 2;
export const PROJECT_NAME_MAX_LENGTH = 120;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const DEFAULT_PROJECT_COLOR = "#4f46e5";

export const projectNameSchema = z
  .string()
  .trim()
  .min(
    PROJECT_NAME_MIN_LENGTH,
    `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters.`,
  )
  .max(
    PROJECT_NAME_MAX_LENGTH,
    `Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer.`,
  );

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(
    PROJECT_DESCRIPTION_MAX_LENGTH,
    `Description must be ${PROJECT_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
  );

export const projectColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR_REGEX, "Color must be a valid hex value such as #4f46e5.");

export const projectStatusSchema = z.enum(PROJECT_STATUSES, {
  message: "Status must be either 'active' or 'archived'.",
});

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema.default(""),
  color: projectColorSchema.default(DEFAULT_PROJECT_COLOR),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema.optional(),
    color: projectColorSchema.optional(),
    status: projectStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.color !== undefined ||
      data.status !== undefined,
    {
      message: "Provide at least one field to update.",
    },
  );

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectSortSchema = z
  .enum(["recent", "oldest", "name-asc", "name-desc", "updated"])
  .default("recent");

export type ProjectSort = z.infer<typeof projectSortSchema>;

export const projectFilterSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", ...PROJECT_STATUSES]).default("all"),
  sort: projectSortSchema.optional(),
});

export type ProjectFilterInput = z.infer<typeof projectFilterSchema>;

export const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ID format.",
});

export type { ProjectStatus };
