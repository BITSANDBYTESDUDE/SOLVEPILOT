import { Schema, Types, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { PROJECT_STATUSES, type ProjectStatus } from "@/types/domain";

export interface ProjectDocument {
  workspaceId: Types.ObjectId;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Hex colour used by the dashboard and project cards. */
  color: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    status: { type: String, enum: [...PROJECT_STATUSES], default: "active", required: true },
    color: {
      type: String,
      default: "#4f46e5",
      trim: true,
      match: [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color must be a hex value such as #4f46e5."],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  baseSchemaOptions,
);

// `workspaceId` index plus compound indexes for status filtering and recency ordering.
projectSchema.index({ workspaceId: 1 }, { name: "workspace_id" });
projectSchema.index({ workspaceId: 1, status: 1 }, { name: "workspace_status" });
projectSchema.index({ workspaceId: 1, createdAt: -1 }, { name: "workspace_recent" });
projectSchema.index(
  { name: "text", description: "text" },
  { name: "project_search", weights: { name: 5, description: 1 }, default_language: "english" },
);

export const Project: Model<ProjectDocument> = registeredModel<ProjectDocument>(
  "Project",
  projectSchema,
  "projects",
);
