import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { Workspace, type WorkspaceDocument, type WorkspaceMember } from "@/models";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/domain";

const log = logger.child("auth:workspace");

/** A `workspaces` document as read back from the driver: the id is present. */
export type StoredWorkspace = WorkspaceDocument & { _id: Types.ObjectId };

/**
 * Workspace authorization (Task 06).
 *
 * Every workspace read in the application goes through here, so the tenancy
 * rule — "a user only ever reaches a workspace they belong to" — is enforced in
 * one place instead of being repeated per route.
 */

/** Higher number means more privilege. Drives every permission comparison. */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

/** True when `actual` carries at least the privilege of `required`. */
export function hasAtLeastRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/**
 * Find a user's membership in a workspace.
 *
 * Compares on string form because a member entry can arrive either as an
 * ObjectId (from the database) or a string (from a JSON payload).
 */
export function findMembership(
  workspace: Pick<WorkspaceDocument, "members">,
  userId: string,
): WorkspaceMember | null {
  return workspace.members.find((member) => String(member.userId) === userId) ?? null;
}

export interface WorkspaceAccess {
  workspace: StoredWorkspace;
  membership: WorkspaceMember;
}

/**
 * Load a workspace and prove the caller belongs to it.
 *
 * A non-member gets a 404, not a 403: answering "forbidden" would confirm the
 * workspace exists, which turns the endpoint into a probe for other tenants'
 * ids.
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAccess> {
  if (!Types.ObjectId.isValid(workspaceId)) {
    throw new NotFoundError("That workspace does not exist.");
  }

  await connectToDatabase();

  const workspace = await Workspace.findById(workspaceId).lean<StoredWorkspace | null>();
  if (!workspace) throw new NotFoundError("That workspace does not exist.");

  const membership = findMembership(workspace, userId);
  if (!membership) {
    log.warn("workspace access denied: not a member", { userId, workspaceId });
    throw new NotFoundError("That workspace does not exist.");
  }

  return { workspace, membership };
}

/**
 * As above, but additionally requires a minimum role.
 *
 * Non-members still get a 404; members without the role get a 403, which is
 * safe because membership is already established at that point.
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  required: WorkspaceRole,
): Promise<WorkspaceAccess> {
  const access = await requireWorkspaceMember(userId, workspaceId);

  if (!hasAtLeastRole(access.membership.role, required)) {
    log.warn("workspace role insufficient", {
      userId,
      workspaceId,
      has: access.membership.role,
      required,
    });
    throw new ForbiddenError("You do not have permission to do that in this workspace.");
  }

  return access;
}

/** Workspaces the user belongs to, newest first, with the caller's role. */
export async function listMemberWorkspaces(
  userId: string,
): Promise<Array<{ workspace: StoredWorkspace; role: WorkspaceRole }>> {
  await connectToDatabase();

  const workspaces = await Workspace.find({ "members.userId": userId })
    .sort({ createdAt: -1 })
    .lean<StoredWorkspace[]>();

  return workspaces.flatMap((workspace) => {
    const membership = findMembership(workspace, userId);
    return membership ? [{ workspace, role: membership.role }] : [];
  });
}

/**
 * Rank helper for ordering role pickers so the most privileged option is first.
 * Exposed so the UI and the service never disagree about precedence.
 */
export function rolesByPrivilege(): WorkspaceRole[] {
  return [...WORKSPACE_ROLES].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}
