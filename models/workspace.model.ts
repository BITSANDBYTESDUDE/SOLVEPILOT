import { Schema, Types, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types/domain";

export interface WorkspaceMember {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
  invitedBy?: Types.ObjectId | null;
}

export interface WorkspaceDocument {
  name: string;
  /** URL-safe identifier, unique across the deployment. */
  slug: string;
  ownerId: Types.ObjectId;
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<WorkspaceMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: { type: String, enum: [...WORKSPACE_ROLES], default: "member", required: true },
    joinedAt: { type: Date, default: () => new Date(), required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may contain lowercase letters, numbers and single hyphens only.",
      ],
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [memberSchema], default: [] },
  },
  baseSchemaOptions,
);

workspaceSchema.index({ slug: 1 }, { unique: true, name: "slug_unique" });
// Primary tenancy access path: "workspaces I am a member of".
workspaceSchema.index({ "members.userId": 1 }, { name: "members_user_id" });
workspaceSchema.index({ createdAt: -1 }, { name: "created_at_desc" });

export const Workspace: Model<WorkspaceDocument> = registeredModel<WorkspaceDocument>(
  "Workspace",
  workspaceSchema,
  "workspaces",
);
