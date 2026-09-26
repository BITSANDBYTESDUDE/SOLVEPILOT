import type { WorkspaceRole } from "@/types/domain";

/**
 * Server-side permission service (Task 07).
 *
 * Implements authoritative role and permission checks for workspaces.
 * All critical authorization decisions must pass through these rules.
 */

export type RoleOrMembership = WorkspaceRole | { role: WorkspaceRole } | null | undefined;

/** Extracts the role string whether passed as a string or an object with a `role` property. */
export function extractWorkspaceRole(target: RoleOrMembership): WorkspaceRole | null {
  if (!target) return null;
  if (typeof target === "string") return target;
  if (typeof target === "object" && "role" in target && typeof target.role === "string") {
    return target.role;
  }
  return null;
}

/** Check if the role is workspace owner. */
export function isWorkspaceOwner(target: RoleOrMembership): boolean {
  return extractWorkspaceRole(target) === "owner";
}

/** Check if the role is workspace admin or owner. */
export function isWorkspaceAdmin(target: RoleOrMembership): boolean {
  const role = extractWorkspaceRole(target);
  return role === "owner" || role === "admin";
}

/** Check if the role is a valid workspace member (owner, admin, or member). */
export function isWorkspaceMember(target: RoleOrMembership): boolean {
  const role = extractWorkspaceRole(target);
  return role === "owner" || role === "admin" || role === "member";
}

/** Check if the user has permission to manage workspace members (owner or admin). */
export function canManageWorkspaceMembers(target: RoleOrMembership): boolean {
  return isWorkspaceAdmin(target);
}

/** Check if the user has permission to edit workspace settings (owner or admin). */
export function canEditWorkspace(target: RoleOrMembership): boolean {
  return isWorkspaceAdmin(target);
}

/**
 * Determines if an actor can add a member with `targetRole`.
 *
 * - Members cannot add anyone.
 * - Admins can add members with role "member" or "admin", but can NEVER promote to "owner".
 * - Owners can add members with any role.
 */
export function canAddWorkspaceMember(
  actor: RoleOrMembership,
  targetRole: WorkspaceRole = "member",
): boolean {
  const actorRole = extractWorkspaceRole(actor);
  if (!actorRole) return false;
  if (actorRole === "member") return false;

  if (actorRole === "admin") {
    // Admin cannot promote anyone to owner
    return targetRole !== "owner";
  }

  if (actorRole === "owner") return true;
  return false;
}

export interface RoleChangeOptions {
  totalOwners?: number;
  isActorSelf?: boolean;
}

/**
 * Determines if an actor can change a member's role from `currentTargetRole` to `newTargetRole`.
 *
 * - Members cannot change roles.
 * - Admins cannot modify owner role, cannot promote anyone to owner, and cannot modify another admin's role.
 * - Owners can change any member's role, but cannot downgrade an owner if that would leave the workspace without an owner.
 */
export function canChangeWorkspaceMemberRole(
  actor: RoleOrMembership,
  currentTargetRole: WorkspaceRole,
  newTargetRole: WorkspaceRole,
  options?: RoleChangeOptions,
): boolean {
  const actorRole = extractWorkspaceRole(actor);
  if (!actorRole) return false;
  if (actorRole === "member") return false;

  if (actorRole === "admin") {
    // Admin cannot modify owner's role
    if (currentTargetRole === "owner") return false;
    // Admin cannot promote anyone to owner
    if (newTargetRole === "owner") return false;
    // Admin cannot modify another admin's role
    if (currentTargetRole === "admin") return false;
    return true;
  }

  if (actorRole === "owner") {
    // Cannot downgrade an owner if that would leave workspace without an owner
    if (currentTargetRole === "owner" && newTargetRole !== "owner") {
      const totalOwners = options?.totalOwners ?? 1;
      if (totalOwners <= 1) return false;
    }
    return true;
  }

  return false;
}

export interface RemoveMemberOptions {
  totalOwners?: number;
  isActorSelf?: boolean;
}

/**
 * Determines if an actor can remove a member with `targetRole`.
 *
 * - Members cannot remove any users.
 * - Admins can remove normal members, but cannot remove owners or other admins.
 * - Owners can remove members, but cannot remove an owner if that would leave the workspace without an owner.
 */
export function canRemoveWorkspaceMember(
  actor: RoleOrMembership,
  targetRole: WorkspaceRole,
  options?: RemoveMemberOptions,
): boolean {
  const actorRole = extractWorkspaceRole(actor);
  if (!actorRole) return false;
  if (actorRole === "member") return false;

  if (targetRole === "owner") {
    // Admin cannot remove owner
    if (actorRole === "admin") return false;
    // Owner cannot remove self/owner if that would leave workspace without an owner
    if (actorRole === "owner") {
      const totalOwners = options?.totalOwners ?? 1;
      if (totalOwners <= 1) return false;
      return true;
    }
  }

  if (actorRole === "admin") {
    // Admin can only remove normal members
    return targetRole === "member";
  }

  if (actorRole === "owner") {
    return true;
  }

  return false;
}

// Project permissions (Task 08)
export function canManageProjects(target: RoleOrMembership): boolean {
  return isWorkspaceAdmin(target);
}

export function canViewProjects(target: RoleOrMembership): boolean {
  return isWorkspaceMember(target);
}

export const canCreateProject = canManageProjects;
export const canEditProject = canManageProjects;
export const canArchiveProject = canManageProjects;
export const canDeleteProject = canManageProjects;

// Problem (issue) permissions (Task 11)
//
// Creating a problem is the entry point of the whole workflow, so every member
// of the workspace may do it — owner, admin and member alike. Role-gating starts
// later, with destructive and administrative issue operations.

export function canViewIssues(target: RoleOrMembership): boolean {
  return isWorkspaceMember(target);
}

export function canCreateIssue(target: RoleOrMembership): boolean {
  return isWorkspaceMember(target);
}

// Convenient aliases
export const canAddMember = canAddWorkspaceMember;
export const canRemoveMember = canRemoveWorkspaceMember;
export const canChangeMemberRole = canChangeWorkspaceMemberRole;
