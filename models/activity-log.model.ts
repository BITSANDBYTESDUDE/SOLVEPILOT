import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityMetadata } from "@/types/domain";

/** Append-only audit trail rendered as the issue and workspace activity timeline. */
export interface ActivityLogDocument {
  workspaceId: Schema.Types.ObjectId;
  /** Null for workspace-level events that are not tied to a single issue. */
  issueId: Schema.Types.ObjectId | null;
  actorId: Schema.Types.ObjectId;
  action: ActivityAction;
  metadata: ActivityMetadata;
  createdAt: Date;
}

const activityLogSchema = new Schema<ActivityLogDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: [...ACTIVITY_ACTIONS], required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

activityLogSchema.index({ workspaceId: 1, createdAt: -1 }, { name: "workspace_recent" });
activityLogSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
activityLogSchema.index({ actorId: 1, createdAt: -1 }, { name: "actor_recent" });
activityLogSchema.index({ action: 1 }, { name: "action" });

export const ActivityLog: Model<ActivityLogDocument> = registeredModel<ActivityLogDocument>(
  "ActivityLog",
  activityLogSchema,
  "activity_logs",
);
