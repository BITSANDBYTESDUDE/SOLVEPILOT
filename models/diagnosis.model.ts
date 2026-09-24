import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";

export interface PossibleCauseDocument {
  title: string;
  explanation: string;
  /** 0–1. Surfaced as "confidence", never as certainty. */
  confidence: number;
}

/**
 * AI diagnosis for an issue.
 *
 * The four buckets enforce intellectual honesty at the data level: what was
 * observed, what is inferred (possible causes), what is at risk and what is
 * merely assumed. Speculation can never be stored as an observation.
 */
export interface DiagnosisDocument {
  issueId: Schema.Types.ObjectId;
  summary: string;
  possibleCauses: PossibleCauseDocument[];
  observations: string[];
  risks: string[];
  assumptions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const possibleCauseSchema = new Schema<PossibleCauseDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    explanation: { type: String, required: true, trim: true, maxlength: 2000 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const diagnosisSchema = new Schema<DiagnosisDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    summary: { type: String, required: true, trim: true, maxlength: 4000 },
    possibleCauses: { type: [possibleCauseSchema], default: [] },
    observations: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    assumptions: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

diagnosisSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });

export const Diagnosis: Model<DiagnosisDocument> = registeredModel<DiagnosisDocument>(
  "Diagnosis",
  diagnosisSchema,
  "diagnoses",
);
