import { Types } from "mongoose";
import { z } from "zod";

import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/domain";

/**
 * Workspace membership validators (Task 07).
 *
 * Request validation for adding members and updating roles. Supported roles
 * are strictly restricted to: "owner" | "admin" | "member".
 */

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES, {
  message: "Role must be one of: owner, admin, member.",
});

export const addWorkspaceMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please provide a valid email address.")
    .toLowerCase(),
  role: z
    .enum(WORKSPACE_ROLES, {
      message: "Role must be one of: owner, admin, member.",
    })
    .default("member"),
});

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

export const updateWorkspaceMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES, {
    message: "Role must be one of: owner, admin, member.",
  }),
});

export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;

export const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ID format.",
});

export type { WorkspaceRole };
