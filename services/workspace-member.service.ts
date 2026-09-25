import "server-only";

import { Types } from "mongoose";

import { findMembership, requireWorkspaceMember } from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { User, Workspace, type WorkspaceMember } from "@/models";
import {
  canAddWorkspaceMember,
  canChangeWorkspaceMemberRole,
  canManageWorkspaceMembers,
  canRemoveWorkspaceMember,
} from "@/services/permission.service";
import type { WorkspaceRole } from "@/types/domain";
import {
  addWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
} from "@/validators/workspace-member";

const log = logger.child("workspace:members");

export interface SafeWorkspaceMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: Date;
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

/**
 * Workspace membership service (Task 07).
 *
 * Implements business operations for workspace members: listing, adding,
 * role updating, and removal. Enforces strict role permission boundaries,
 * single-owner protection, and workspace tenancy isolation.
 */

/**
 * List all members of a workspace with safe user information.
 *
 * Tenancy check ensures only members of the workspace can read the member list.
 * Never exposes password hashes, secrets, or internal user preferences.
 */
export async function getWorkspaceMembers(
  userId: string,
  workspaceId: string,
): Promise<SafeWorkspaceMember[]> {
  const { workspace } = await requireWorkspaceMember(userId, workspaceId);

  await connectToDatabase();

  const userIds = workspace.members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name email avatarUrl")
    .lean<Array<{ _id: Types.ObjectId; name: string; email: string; avatarUrl?: string | null }>>();

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const members: SafeWorkspaceMember[] = workspace.members.map((m) => {
    const user = userMap.get(String(m.userId));
    return {
      userId: String(m.userId),
      name: user?.name ?? "Unknown User",
      email: user?.email ?? "",
      avatarUrl: user?.avatarUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    };
  });

  // Sort by role privilege descending (owner, admin, member), then by joinedAt ascending
  members.sort((a, b) => {
    const rankDiff = (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });

  return members;
}

/**
 * Add a new member to the workspace.
 *
 * Verifies that:
 * 1. The workspace exists and caller is an authorized member (owner or admin).
 * 2. An admin cannot add an "owner".
 * 3. The target user exists in the database.
 * 4. The target user is not already a member of this workspace.
 */
export async function addWorkspaceMember(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<SafeWorkspaceMember> {
  const parsed = addWorkspaceMemberSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid member data.");
  }

  const { email, role } = parsed.data;

  const { workspace, membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canManageWorkspaceMembers(membership.role)) {
    throw new ForbiddenError("You do not have permission to manage workspace members.");
  }

  if (!canAddWorkspaceMember(membership.role, role)) {
    if (membership.role === "admin" && role === "owner") {
      throw new ForbiddenError("Admins cannot add or promote members to owner.");
    }
    throw new ForbiddenError("You do not have permission to add members with this role.");
  }

  await connectToDatabase();

  const targetUser = await User.findOne({ email }).select("_id name email avatarUrl").lean<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    avatarUrl?: string | null;
  }>();

  if (!targetUser) {
    throw new NotFoundError("No user found with that email address.");
  }

  const existingMember = findMembership(workspace, String(targetUser._id));
  if (existingMember) {
    throw new ConflictError("User is already a member of this workspace.");
  }

  const newMember: WorkspaceMember = {
    userId: targetUser._id,
    role,
    joinedAt: new Date(),
    invitedBy: new Types.ObjectId(userId),
  };

  await Workspace.findByIdAndUpdate(workspaceId, {
    $push: { members: newMember },
  });

  log.info("workspace member added", {
    workspaceId,
    targetUserId: String(targetUser._id),
    role,
    addedBy: userId,
  });

  return {
    userId: String(targetUser._id),
    name: targetUser.name,
    email: targetUser.email,
    avatarUrl: targetUser.avatarUrl ?? null,
    role,
    joinedAt: newMember.joinedAt,
  };
}

/**
 * Update the role of an existing workspace member.
 *
 * Rules:
 * - Members cannot change roles.
 * - Admins cannot modify owner role, cannot promote anyone to owner, and cannot modify another admin's role.
 * - Owners can change roles, but cannot downgrade an owner if that would leave the workspace without an owner.
 */
export async function updateWorkspaceMemberRole(
  userId: string,
  workspaceId: string,
  targetUserId: string,
  input: unknown,
): Promise<SafeWorkspaceMember> {
  if (!Types.ObjectId.isValid(targetUserId)) {
    throw new NotFoundError("Member not found in this workspace.");
  }

  const parsed = updateWorkspaceMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid role data.");
  }

  const { role: newRole } = parsed.data;

  const { workspace, membership } = await requireWorkspaceMember(userId, workspaceId);

  const targetMember = findMembership(workspace, targetUserId);
  if (!targetMember) {
    throw new NotFoundError("Member not found in this workspace.");
  }

  const totalOwners = workspace.members.filter((m) => m.role === "owner").length;
  const isActorSelf = String(userId) === targetUserId;

  if (
    !canChangeWorkspaceMemberRole(membership.role, targetMember.role, newRole, {
      totalOwners,
      isActorSelf,
    })
  ) {
    if (membership.role === "member") {
      throw new ForbiddenError("Members cannot change member roles.");
    }
    if (membership.role === "admin") {
      if (targetMember.role === "owner") {
        throw new ForbiddenError("Admins cannot modify an owner's role.");
      }
      if (newRole === "owner") {
        throw new ForbiddenError("Admins cannot promote a user to owner.");
      }
      if (targetMember.role === "admin") {
        throw new ForbiddenError("Admins cannot modify another admin's role.");
      }
    }
    if (targetMember.role === "owner" && totalOwners <= 1) {
      throw new ForbiddenError(
        "Cannot downgrade the workspace owner. A workspace must have at least one owner.",
      );
    }
    throw new ForbiddenError("You do not have permission to change this member's role.");
  }

  await connectToDatabase();

  await Workspace.updateOne(
    { _id: workspaceId, "members.userId": new Types.ObjectId(targetUserId) },
    { $set: { "members.$.role": newRole } },
  );

  const targetUser = await User.findById(targetUserId).select("_id name email avatarUrl").lean<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    avatarUrl?: string | null;
  }>();

  log.info("workspace member role updated", {
    workspaceId,
    targetUserId,
    previousRole: targetMember.role,
    newRole,
    updatedBy: userId,
  });

  return {
    userId: targetUserId,
    name: targetUser?.name ?? "Unknown User",
    email: targetUser?.email ?? "",
    avatarUrl: targetUser?.avatarUrl ?? null,
    role: newRole,
    joinedAt: targetMember.joinedAt,
  };
}

/**
 * Remove a member from the workspace.
 *
 * Rules:
 * - Members cannot remove users.
 * - Admins can remove normal members, but cannot remove owners or other admins.
 * - Owners cannot be removed if that would leave the workspace without an owner.
 */
export async function removeWorkspaceMember(
  userId: string,
  workspaceId: string,
  targetUserId: string,
): Promise<{ success: true }> {
  if (!Types.ObjectId.isValid(targetUserId)) {
    throw new NotFoundError("Member not found in this workspace.");
  }

  const { workspace, membership } = await requireWorkspaceMember(userId, workspaceId);

  const targetMember = findMembership(workspace, targetUserId);
  if (!targetMember) {
    throw new NotFoundError("Member not found in this workspace.");
  }

  const totalOwners = workspace.members.filter((m) => m.role === "owner").length;
  const isActorSelf = String(userId) === targetUserId;

  if (
    !canRemoveWorkspaceMember(membership.role, targetMember.role, {
      totalOwners,
      isActorSelf,
    })
  ) {
    if (membership.role === "member") {
      throw new ForbiddenError("Members cannot remove workspace members.");
    }
    if (membership.role === "admin") {
      if (targetMember.role === "owner") {
        throw new ForbiddenError("Admins cannot remove an owner.");
      }
      if (targetMember.role === "admin") {
        throw new ForbiddenError("Admins can only remove normal members.");
      }
    }
    if (targetMember.role === "owner" && totalOwners <= 1) {
      throw new ForbiddenError(
        "Cannot remove the workspace owner. A workspace must have at least one owner.",
      );
    }
    throw new ForbiddenError("You do not have permission to remove this member.");
  }

  await connectToDatabase();

  await Workspace.findByIdAndUpdate(workspaceId, {
    $pull: { members: { userId: new Types.ObjectId(targetUserId) } },
  });

  // If the removed member was the primary ownerId and other owners remain, migrate ownerId:
  if (String(workspace.ownerId) === targetUserId) {
    const nextOwner = workspace.members.find(
      (m) => m.role === "owner" && String(m.userId) !== targetUserId,
    );
    if (nextOwner) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        $set: { ownerId: nextOwner.userId },
      });
    }
  }

  log.info("workspace member removed", {
    workspaceId,
    targetUserId,
    removedBy: userId,
  });

  return { success: true };
}
