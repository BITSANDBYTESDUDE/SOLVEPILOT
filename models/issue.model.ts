import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import {
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_SOURCES,
  ISSUE_STATUSES,
  type IssueCategory,
  type IssuePriority,
  type IssueSource,
  type IssueStatus,
} from "@/types/domain";

/** The core entity of SolvePilot: one problem, end to end. */
export interface IssueDocument {
  workspaceId: Schema.Types.ObjectId;
  projectId: Schema.Types.ObjectId;
  createdBy: Schema.Types.ObjectId;
  /** Optional owner of the work; drives issue-assignment notifications. */
  assignedTo: Schema.Types.ObjectId | null;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  priority: IssuePriority;
  source: IssueSource;
  /** AI classification confidence, 0–1. Null until classified. */
  aiConfidence: number | null;
  /** AI effort estimate in minutes. Null until planned. */
  estimatedMinutes: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema<IssueDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 10_000 },
    category: { type: String, enum: [...ISSUE_CATEGORIES], default: "other", required: true },
    status: { type: String, enum: [...ISSUE_STATUSES], default: "new", required: true },
    priority: { type: String, enum: [...ISSUE_PRIORITIES], default: "medium", required: true },
    source: { type: String, enum: [...ISSUE_SOURCES], default: "text", required: true },
    aiConfidence: { type: Number, default: null, min: 0, max: 1 },
    estimatedMinutes: { type: Number, default: null, min: 0, max: 100_000 },
    resolvedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

issueSchema.index(
  { workspaceId: 1, status: 1, createdAt: -1 },
  { name: "workspace_status_recent" },
);
issueSchema.index({ workspaceId: 1, createdAt: -1 }, { name: "workspace_recent" });
issueSchema.index({ workspaceId: 1, priority: 1 }, { name: "workspace_priority" });
issueSchema.index({ workspaceId: 1, category: 1 }, { name: "workspace_category" });
issueSchema.index({ workspaceId: 1, assignedTo: 1 }, { name: "workspace_assignee" });
issueSchema.index({ projectId: 1, createdAt: -1 }, { name: "project_recent" });
issueSchema.index({ status: 1, createdAt: -1 }, { name: "status_recent" });
issueSchema.index({ resolvedAt: -1 }, { name: "resolved_recent" });
issueSchema.index(
  { title: "text", description: "text" },
  { name: "issue_search", weights: { title: 5, description: 1 }, default_language: "english" },
);

export const Issue: Model<IssueDocument> = registeredModel<IssueDocument>(
  "Issue",
  issueSchema,
  "issues",
);
