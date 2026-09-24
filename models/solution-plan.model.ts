import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";

export interface SolutionStepDocument {
  order: number;
  title: string;
  description: string;
}

/** AI solution plan derived from a diagnosis; the source of generated tasks. */
export interface SolutionPlanDocument {
  issueId: Schema.Types.ObjectId;
  objective: string;
  recommendations: string[];
  steps: SolutionStepDocument[];
  /** Total estimated effort in minutes for the whole plan. */
  estimatedMinutes: number | null;
  createdAt: Date;
}

const solutionStepSchema = new Schema<SolutionStepDocument>(
  {
    order: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const solutionPlanSchema = new Schema<SolutionPlanDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    objective: { type: String, required: true, trim: true, maxlength: 2000 },
    recommendations: { type: [String], default: [] },
    steps: { type: [solutionStepSchema], default: [] },
    estimatedMinutes: { type: Number, default: null, min: 0, max: 100_000 },
  },
  baseSchemaOptions,
);

solutionPlanSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });

export const SolutionPlan: Model<SolutionPlanDocument> = registeredModel<SolutionPlanDocument>(
  "SolutionPlan",
  solutionPlanSchema,
  "solution_plans",
);
