import "server-only";

import { Types } from "mongoose";

import {
  listMemberWorkspaces,
  requireWorkspaceMember,
  requireWorkspaceRole,
  type StoredWorkspace,
} from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
import { Workspace, type WorkspaceMember } from "@/models";
import { createActivity } from "@/services/activity.service";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/validators/workspace";
import type { WorkspaceRole } from "@/types/domain";

const log = logger.child("workspace:service");

/** Fallback when a name slugifies to nothing (e.g. a purely non-Latin name). */
const FALLBACK_SLUG = "workspace";

/** Give up after this many collision attempts rather than looping forever. */
const MAX_SLUG_ATTEMPTS = 20;

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  memberCount: number;
  /** The caller's own role — the UI shows this, and it is never taken from input. */
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workspace service (Task 06).
 *
 * Authorization note: `userId` always comes from the session, and every read is
 * filtered by membership. A caller can never name a workspace they do not
 * belong to and get data back — see `lib/auth/workspace.ts`.
 */

/**
 * Create a workspace and make the creator its `owner`.
 *
 * The owner is added as a member in the same write, so a workspace can never
 * exist without an owner entry — otherwise the membership check would lock out
 * the person who just created it.
 */
export async function createWorkspace(userId: string, input: unknown): Promise<WorkspaceSummary> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid workspace data.");
  }

  const { name, slug } = parsed.data;

  await connectToDatabase();

  const baseSlug = slug ?? slugify(name) ?? FALLBACK_SLUG;
  const uniqueSlug = await reserveSlug(baseSlug);

  let created: StoredWorkspace;
  try {
    created = (await Workspace.create({
      name,
      slug: uniqueSlug,
      ownerId: new Types.ObjectId(userId),
      // The creator starts as owner. `role` is never read from the request.
      members: [
        {
          userId: new Types.ObjectId(userId),
          role: "owner",
          joinedAt: new Date(),
          invitedBy: null,
        } satisfies WorkspaceMember,
      ],
    })) as unknown as StoredWorkspace;
  } catch (error) {
    // Two people can pick the same slug in the same instant; the unique index
    // is the real guard, so translate its error into something actionable.
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("That workspace slug is already taken.");
    }
    throw error;
  }

  log.info("workspace created", { userId, workspaceId: String(created._id) });

  void createActivity({
    workspaceId: String(created._id),
    actorId: userId,
    action: "workspace.created",
    metadata: {
      workspaceName: created.name,
      slug: created.slug,
    },
  });

  return toSummary(created, "owner");
}

/** Workspaces the caller belongs to, newest first. */
export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const entries = await listMemberWorkspaces(userId);
  return entries.map(({ workspace, role }) => toSummary(workspace, role));
}

/** One workspace, only if the caller is a member. */
export async function getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceSummary> {
  const { workspace, membership } = await requireWorkspaceMember(userId, workspaceId);
  return toSummary(workspace, membership.role);
}

/** Rename a workspace or change its slug. Requires `admin` or above. */
export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<WorkspaceSummary> {
  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid workspace data.");
  }

  const { name, slug } = parsed.data;
  const { workspace, membership } = await requireWorkspaceRole(userId, workspaceId, "admin");

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined && slug !== workspace.slug) {
    // Reserve against every workspace except this one.
    updates.slug = await reserveSlug(slug, workspaceId);
  }

  if (Object.keys(updates).length === 0) {
    return toSummary(workspace, membership.role);
  }

  await connectToDatabase();

  let updated: StoredWorkspace | null;
  try {
    updated = await Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: updates },
      { new: true },
    ).lean<StoredWorkspace | null>();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("That workspace slug is already taken.");
    }
    throw error;
  }

  if (!updated) throw new ConflictError("That workspace could not be updated.");

  log.info("workspace updated", { userId, workspaceId, fields: Object.keys(updates) });

  void createActivity({
    workspaceId,
    actorId: userId,
    action: "workspace.updated",
    metadata: {
      changedFields: Object.keys(updates),
      name: updated.name,
      slug: updated.slug,
    },
  });

  return toSummary(updated, membership.role);
}

/**
 * Find a slug nobody has taken.
 *
 * Appends `-2`, `-3`, … rather than failing, so "Acme" and a second "Acme"
 * coexist as `acme` and `acme-2`. `exceptId` lets an update keep its own slug.
 */
async function reserveSlug(base: string, exceptId?: string): Promise<string> {
  const filterFor = (candidate: string) => {
    const filter: Record<string, unknown> = { slug: candidate };
    if (exceptId) filter._id = { $ne: new Types.ObjectId(exceptId) };
    return filter;
  };

  let candidate = base;
  for (let attempt = 2; attempt <= MAX_SLUG_ATTEMPTS + 1; attempt += 1) {
    const taken = await Workspace.exists(filterFor(candidate));
    if (!taken) return candidate;
    candidate = `${base}-${attempt}`;
  }

  throw new ConflictError("Could not find an available slug. Please choose one yourself.");
}

/** MongoDB unique-index violation (E11000). */
function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 11000;
}

function toSummary(workspace: StoredWorkspace, role: WorkspaceRole): WorkspaceSummary {
  return {
    id: String(workspace._id),
    name: workspace.name,
    slug: workspace.slug,
    ownerId: String(workspace.ownerId),
    memberCount: workspace.members.length,
    role,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}
