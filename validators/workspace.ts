import { z } from "zod";

/**
 * Workspace validators (Task 06).
 *
 * Slugs are URL identifiers shared across the whole deployment, so the rules
 * here mirror the schema regex exactly — an invalid slug must be rejected
 * before it reaches the unique index and surfaces as an opaque duplicate-key
 * error.
 */

export const WORKSPACE_NAME_MIN_LENGTH = 2;
export const WORKSPACE_NAME_MAX_LENGTH = 80;
export const WORKSPACE_SLUG_MAX_LENGTH = 64;

/**
 * Slugs that must never be handed to a workspace.
 *
 * Workspaces are not addressed by slug in the URL today, but reserving these
 * keeps the option open and stops a workspace from squatting a future route.
 */
export const RESERVED_WORKSPACE_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "dashboard",
  "login",
  "logout",
  "new",
  "register",
  "settings",
  "share",
  "static",
  "www",
]);

/** Matches the `workspaces` schema regex — keep the two in sync. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const nameSchema = z
  .string()
  .trim()
  .min(
    WORKSPACE_NAME_MIN_LENGTH,
    `Workspace names must be at least ${WORKSPACE_NAME_MIN_LENGTH} characters.`,
  )
  .max(
    WORKSPACE_NAME_MAX_LENGTH,
    `Workspace names must be ${WORKSPACE_NAME_MAX_LENGTH} characters or fewer.`,
  );

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(WORKSPACE_SLUG_MAX_LENGTH, `Slugs must be ${WORKSPACE_SLUG_MAX_LENGTH} characters or fewer.`)
  .refine((value) => SLUG_PATTERN.test(value), {
    message: "Slugs may contain lowercase letters, numbers and single hyphens only.",
  })
  .refine((value) => !RESERVED_WORKSPACE_SLUGS.has(value), {
    message: "That slug is reserved. Please choose another.",
  });

export const createWorkspaceSchema = z.object({
  name: nameSchema,
  /**
   * Optional on purpose: omitting it derives a slug from the name, which is
   * what most people expect. Supplying one keeps the URL under the user's
   * control.
   */
  slug: slugSchema.optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z
  .object({
    name: nameSchema.optional(),
    slug: slugSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.slug !== undefined, {
    message: "Provide at least one field to update.",
  });

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
