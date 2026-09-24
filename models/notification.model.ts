import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { NOTIFICATION_TYPES, type NotificationType } from "@/types/domain";

/**
 * In-app notification for a single recipient.
 *
 * Read state is stored per user (`readAt`), so unread counts and the "mark all
 * as read" action stay cheap and correct even with many notifications.
 */
export interface NotificationDocument {
  userId: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  issueId: Schema.Types.ObjectId | null;
  taskId: Schema.Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  /** In-app path to open, e.g. `/dashboard/issues/<id>`. */
  link: string;
  /** The user who triggered the notification (null for system events). */
  actorId: Schema.Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, default: "", trim: true, maxlength: 1000 },
    link: { type: String, required: true, trim: true, maxlength: 512 },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    readAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

notificationSchema.index(
  { userId: 1, readAt: 1, createdAt: -1 },
  { name: "recipient_unread_recent" },
);
notificationSchema.index({ userId: 1, createdAt: -1 }, { name: "recipient_recent" });

export const Notification: Model<NotificationDocument> = registeredModel<NotificationDocument>(
  "Notification",
  notificationSchema,
  "notifications",
);
