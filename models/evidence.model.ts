import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { EVIDENCE_TYPES, type EvidenceType } from "@/types/domain";

/**
 * Proof attached to an issue: what it looked like before the fix, what it looks
 * like after, and anything supporting in between.
 */
export interface EvidenceDocument {
  issueId: Schema.Types.ObjectId;
  type: EvidenceType;
  fileUrl: string;
  storageKey: string;
  /** Kept so the gallery can render the right preview without a HEAD request. */
  mimeType: string | null;
  sizeBytes: number;
  caption: string;
  uploadedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const evidenceSchema = new Schema<EvidenceDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    type: { type: String, enum: [...EVIDENCE_TYPES], required: true },
    fileUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    storageKey: { type: String, required: true, trim: true, maxlength: 1024 },
    mimeType: { type: String, trim: true, maxlength: 255, default: null },
    sizeBytes: { type: Number, default: 0, min: 0 },
    caption: { type: String, default: "", trim: true, maxlength: 500 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  baseSchemaOptions,
);

evidenceSchema.index({ issueId: 1, type: 1, createdAt: -1 }, { name: "issue_type_recent" });
evidenceSchema.index({ uploadedBy: 1 }, { name: "uploaded_by" });

export const Evidence: Model<EvidenceDocument> = registeredModel<EvidenceDocument>(
  "Evidence",
  evidenceSchema,
  "evidence",
);
