import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import {
  VERIFICATION_CHECK_RESULTS,
  VERIFICATION_METHODS,
  VERIFICATION_STATUSES,
  type VerificationCheckResult,
  type VerificationMethod,
  type VerificationStatus,
} from "@/types/domain";

export interface VerificationCheckDocument {
  name: string;
  result: VerificationCheckResult;
  explanation: string;
}

/**
 * Verification record for an issue.
 *
 * `needs_review` is a first-class outcome: when the attached evidence cannot
 * prove the problem is solved, the record must not claim success.
 */
export interface VerificationDocument {
  issueId: Schema.Types.ObjectId;
  method: VerificationMethod;
  status: VerificationStatus;
  summary: string;
  checks: VerificationCheckDocument[];
  /** 0–1 confidence reported by the verifier; null for purely manual reviews. */
  confidence: number | null;
  /** Set when method is "ai" or "combined"; null for manual verification. */
  verifiedBy: Schema.Types.ObjectId | null;
  createdAt: Date;
}

const verificationCheckSchema = new Schema<VerificationCheckDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    result: { type: String, enum: [...VERIFICATION_CHECK_RESULTS], required: true },
    explanation: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const verificationSchema = new Schema<VerificationDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    method: { type: String, enum: [...VERIFICATION_METHODS], required: true },
    status: { type: String, enum: [...VERIFICATION_STATUSES], required: true },
    summary: { type: String, required: true, trim: true, maxlength: 4000 },
    checks: { type: [verificationCheckSchema], default: [] },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  baseSchemaOptions,
);

verificationSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
verificationSchema.index({ status: 1, createdAt: -1 }, { name: "status_recent" });

export const Verification: Model<VerificationDocument> = registeredModel<VerificationDocument>(
  "Verification",
  verificationSchema,
  "verifications",
);
