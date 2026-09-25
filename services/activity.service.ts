import "server-only";

import { Types } from "mongoose";

import { requireWorkspaceMember } from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ActivityLog, User, type ActivityLogDocument } from "@/models";
import type { ActivityAction } from "@/types/domain";
import { activityQuerySchema } from "@/validators/activity";

const log = logger.child("activity:service");

export interface SafeActivityActor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface SafeActivityItem {
  id: string;
  workspaceId: string;
  issueId: string | null;
  actor: SafeActivityActor;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityItem = SafeActivityItem;

export interface PaginatedActivities {
  activities: SafeActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateActivityParams {
  workspaceId: string;
  actorId: string;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
  issueId?: string | null;
}

/** Keys that must never be persisted in activity log metadata. */
const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "key",
  "auth",
  "hash",
  "credential",
];

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEY_FRAGMENTS.some((fragment) => lowerKey.includes(fragment));
    if (isSensitive) continue;

    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Reusable activity creation service (Task 10).
 *
 * Persists an audited workspace activity event. Sanitizes metadata to prevent
 * accidental credential leakage. Does not throw if an error occurs inside a
 * secondary fire-and-forget call.
 */
export async function createActivity(
  params: CreateActivityParams,
): Promise<SafeActivityItem | null> {
  const { workspaceId, actorId, action, metadata, issueId } = params;

  if (!Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(actorId)) {
    log.warn("failed to create activity: invalid ObjectId provided", {
      workspaceId,
      actorId,
      action,
    });
    return null;
  }

  await connectToDatabase();

  const sanitized = sanitizeMetadata(metadata);

  try {
    const created = await ActivityLog.create({
      workspaceId: new Types.ObjectId(workspaceId),
      issueId: issueId && Types.ObjectId.isValid(issueId) ? new Types.ObjectId(issueId) : null,
      actorId: new Types.ObjectId(actorId),
      action,
      metadata: sanitized,
    });

    log.info("activity logged", {
      workspaceId,
      actorId,
      action,
      activityId: String(created._id),
    });

    return {
      id: String(created._id),
      workspaceId: String(created.workspaceId),
      issueId: created.issueId ? String(created.issueId) : null,
      actor: {
        id: String(created.actorId),
        name: "User",
      },
      action: created.action,
      metadata: (created.metadata as Record<string, unknown>) ?? {},
      createdAt: created.createdAt,
    };
  } catch (error) {
    log.error("failed to create activity log record", error, { workspaceId, actorId, action });
    return null;
  }
}

/**
 * Retrieve paginated activities for an authorized workspace.
 * Resolves safe actor information efficiently in a single query avoiding N+1 lookups.
 */
export async function getWorkspaceActivities(
  userId: string,
  workspaceId: string,
  queryOptions?: {
    page?: number | string;
    limit?: number | string;
    action?: string;
    projectId?: string;
  },
): Promise<PaginatedActivities> {
  await requireWorkspaceMember(userId, workspaceId);

  const parsed = activityQuerySchema.safeParse(queryOptions ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid activity query.");
  }

  const { page, limit, action, projectId } = parsed.data;

  await connectToDatabase();

  const workspaceObjectId = new Types.ObjectId(workspaceId);
  const query: Record<string, unknown> = { workspaceId: workspaceObjectId };

  if (action) {
    query.action = action;
  }

  if (projectId && Types.ObjectId.isValid(projectId)) {
    query["metadata.projectId"] = projectId;
  }

  const skip = (page - 1) * limit;

  const [total, activities] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<Array<ActivityLogDocument & { _id: Types.ObjectId }>>(),
  ]);

  // Batch-fetch actors to avoid N+1 query overhead
  const actorIds = [...new Set(activities.map((a) => String(a.actorId)))];
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("_id name email avatarUrl")
    .lean<Array<{ _id: Types.ObjectId; name: string; email: string; avatarUrl?: string | null }>>();

  const actorMap = new Map(actors.map((u) => [String(u._id), u]));

  const items: SafeActivityItem[] = activities.map((a) => {
    const actorUser = actorMap.get(String(a.actorId));
    return {
      id: String(a._id),
      workspaceId: String(a.workspaceId),
      issueId: a.issueId ? String(a.issueId) : null,
      actor: {
        id: String(a.actorId),
        name: actorUser?.name ?? "Former Member",
        email: actorUser?.email,
        avatarUrl: actorUser?.avatarUrl ?? null,
      },
      action: a.action,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
      createdAt: a.createdAt,
    };
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    activities: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieve recent activities for the workspace (used by the dashboard overview).
 */
export async function getRecentWorkspaceActivities(
  userId: string,
  workspaceId: string,
  limit = 5,
): Promise<SafeActivityItem[]> {
  const result = await getWorkspaceActivities(userId, workspaceId, { page: 1, limit });
  return result.activities;
}
