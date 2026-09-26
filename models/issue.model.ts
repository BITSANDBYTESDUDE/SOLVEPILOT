import { Schema, Types, type Model } from "mongoose";

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

/**
 * The core entity of SolvePilot: one problem, end to end (Task 11).
 *
 * Every reference is an ObjectId — a problem never embeds a user, workspace or
 * project document, so renaming a project or a member cannot leave stale copies
 * behind and a leaked issue document cannot leak another collection with it.
 *
 * Only the creation fields are written in Task 11. The AI-driven fields
 * (`aiConfidence`, `estimatedMinutes`, `resolvedAt`) stay `null` until their own
 * tasks populate them, which keeps "not analysed yet" distinguishable from
 * "analysed with zero confidence".
 */
export interface IssueDocument {
  workspaceId: Types.ObjectId;
  /** Optional: a problem may live directly in the workspace, outside any project. */
  projectId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  /** Optional owner of the work; drives issue-assignment notifications. */
  assignedTo: Types.ObjectId | null;
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
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 10_000 },
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

/**
 * Indexes, one per query the product actually issues.
 *
 * Every read is scoped to the caller's workspace first, so each compound index
 * leads with `workspaceId`; `projectId`/`createdBy` cover the two remaining
 * access paths (a project's problems, "problems I created"). Indexes for
 * assignment and resolution reporting are added together with the tasks that
 * query them, rather than pre-created here.
 */
issueSchema.index({ workspaceId: 1, createdAt: -1 }, { name: "workspace_recent" });
issueSchema.index(
  { workspaceId: 1, status: 1, createdAt: -1 },
  { name: "workspace_status_recent" },
);
issueSchema.index({ workspaceId: 1, priority: 1 }, { name: "workspace_priority" });
issueSchema.index({ workspaceId: 1, category: 1 }, { name: "workspace_category" });
issueSchema.index({ projectId: 1, createdAt: -1 }, { name: "project_recent" });
issueSchema.index({ createdBy: 1, createdAt: -1 }, { name: "creator_recent" });
issueSchema.index(
  { title: "text", description: "text" },
  { name: "issue_search", weights: { title: 5, description: 1 }, default_language: "english" },
);

export const Issue: Model<IssueDocument> = registeredModel<IssueDocument>(
  "Issue",
  issueSchema,
  "issues",
);
