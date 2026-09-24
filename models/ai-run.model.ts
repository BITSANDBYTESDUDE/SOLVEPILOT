import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { AI_RUN_STATUSES, AI_RUN_TYPES, type AiRunStatus, type AiRunType } from "@/types/domain";

/**
 * Usage log for every AI operation.
 *
 * Supports debugging (why did classification return this?), monitoring
 * (error rates and latency), and cost analysis (token spend per issue/type).
 */
export interface AiRunDocument {
  issueId: Schema.Types.ObjectId;
  type: AiRunType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: AiRunStatus;
  /** Sanitized failure message; never contains provider credentials. */
  error: string | null;
  createdAt: Date;
}

const aiRunSchema = new Schema<AiRunDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    type: { type: String, enum: [...AI_RUN_TYPES], required: true },
    model: { type: String, required: true, trim: true, maxlength: 100 },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    latencyMs: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: [...AI_RUN_STATUSES], required: true },
    error: { type: String, default: null, maxlength: 2000 },
  },
  baseSchemaOptions,
);

aiRunSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
aiRunSchema.index({ type: 1, createdAt: -1 }, { name: "type_recent" });
aiRunSchema.index({ status: 1, createdAt: -1 }, { name: "status_recent" });

export const AiRun: Model<AiRunDocument> = registeredModel<AiRunDocument>(
  "AiRun",
  aiRunSchema,
  "ai_runs",
);
