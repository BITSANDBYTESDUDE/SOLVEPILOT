import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import {
  INPUT_TYPES,
  PROCESSING_STATUSES,
  type InputType,
  type ProcessingStatus,
} from "@/types/domain";

/**
 * One captured input attached to an issue (text, image, PDF or audio).
 *
 * File bytes live in object storage — this collection only stores metadata,
 * the storage key and whatever text was extracted from the file.
 */
export interface IssueInputDocument {
  issueId: Schema.Types.ObjectId;
  type: InputType;
  originalName: string | null;
  storageKey: string | null;
  storageUrl: string | null;
  mimeType: string | null;
  sizeBytes: number;
  extractedText: string;
  processingStatus: ProcessingStatus;
  /** Populated when processingStatus is "failed" — shown to the user for retry. */
  processingError: string | null;
  createdAt: Date;
}

const issueInputSchema = new Schema<IssueInputDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    type: { type: String, enum: [...INPUT_TYPES], required: true },
    originalName: { type: String, trim: true, maxlength: 255, default: null },
    storageKey: { type: String, trim: true, maxlength: 1024, default: null },
    storageUrl: { type: String, trim: true, maxlength: 2048, default: null },
    mimeType: { type: String, trim: true, maxlength: 255, default: null },
    sizeBytes: { type: Number, default: 0, min: 0 },
    extractedText: { type: String, default: "", maxlength: 100_000 },
    processingStatus: {
      type: String,
      enum: [...PROCESSING_STATUSES],
      default: "pending",
      required: true,
    },
    processingError: { type: String, default: null, maxlength: 1000 },
  },
  baseSchemaOptions,
);

issueInputSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
issueInputSchema.index({ processingStatus: 1 }, { name: "processing_status" });

export const IssueInput: Model<IssueInputDocument> = registeredModel<IssueInputDocument>(
  "IssueInput",
  issueInputSchema,
  "issue_inputs",
);
