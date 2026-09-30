import { Schema, Types, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_PROCESSING_STATUS,
  EXTRACTION_STATUS,
  type AttachmentCategory,
  type AttachmentProcessingStatus,
  type ExtractionStatus,
} from "@/types/domain";

export {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_PROCESSING_STATUS,
  EXTRACTION_STATUS,
  type AttachmentCategory,
  type AttachmentProcessingStatus,
  type ExtractionStatus,
} from "@/types/domain";

export interface IssueAttachmentDocument {
  workspaceId: Types.ObjectId;
  issueId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  category: AttachmentCategory;
  processingStatus: AttachmentProcessingStatus;
  processingError?: string;
  checksum?: string;
  detectedMimeType?: string;
  extractionStatus: ExtractionStatus;
  extractedCharacterCount?: number;
  extractedPageCount?: number;
  extractionError?: string;
  extractedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const issueAttachmentSchema = new Schema<IssueAttachmentDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true, trim: true, minlength: 1, maxlength: 255 },
    storageKey: { type: String, required: true, trim: true, maxlength: 1024 },
    mimeType: { type: String, required: true, trim: true, maxlength: 255 },
    size: { type: Number, required: true, min: 1 },
    category: { type: String, enum: [...ATTACHMENT_CATEGORIES], required: true },
    processingStatus: {
      type: String,
      enum: [...ATTACHMENT_PROCESSING_STATUS],
      required: true,
      default: "uploaded",
    },
    processingError: { type: String, maxlength: 1000 },
    checksum: { type: String, match: /^[a-f0-9]{64}$/ },
    detectedMimeType: { type: String, trim: true, maxlength: 255 },
    extractionStatus: {
      type: String,
      enum: [...EXTRACTION_STATUS],
      required: true,
      default: "not_started",
    },
    extractedCharacterCount: { type: Number, min: 0 },
    extractedPageCount: { type: Number, min: 0 },
    extractionError: { type: String, maxlength: 1000 },
    extractedAt: { type: Date },
  },
  baseSchemaOptions,
);

issueAttachmentSchema.index(
  { workspaceId: 1, issueId: 1, createdAt: -1 },
  { name: "workspace_issue_recent" },
);
issueAttachmentSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
issueAttachmentSchema.index({ uploadedBy: 1, createdAt: -1 }, { name: "uploader_recent" });
issueAttachmentSchema.index(
  { issueId: 1, checksum: 1 },
  {
    name: "issue_checksum_unique",
    unique: true,
    partialFilterExpression: { checksum: { $type: "string" } },
  },
);

export const IssueAttachment: Model<IssueAttachmentDocument> =
  registeredModel<IssueAttachmentDocument>(
    "IssueAttachment",
    issueAttachmentSchema,
    "issue_attachments",
  );
