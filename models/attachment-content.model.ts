import { Schema, Types, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";

export interface AttachmentContentDocument {
  attachmentId: Types.ObjectId;
  issueId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  text: string;
  characterCount: number;
  pageCount?: number;
  truncated: boolean;
  extractorVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentContentSchema = new Schema<AttachmentContentDocument>(
  {
    attachmentId: {
      type: Schema.Types.ObjectId,
      ref: "IssueAttachment",
      required: true,
    },
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    text: { type: String, required: true, maxlength: 5_000_000 },
    characterCount: { type: Number, required: true, min: 0, max: 5_000_000 },
    pageCount: { type: Number, min: 0 },
    truncated: { type: Boolean, required: true, default: false },
    extractorVersion: { type: String, required: true, trim: true, maxlength: 32 },
  },
  baseSchemaOptions,
);

attachmentContentSchema.index(
  { attachmentId: 1 },
  { name: "attachment_content_unique", unique: true },
);

export const AttachmentContent: Model<AttachmentContentDocument> =
  registeredModel<AttachmentContentDocument>(
    "AttachmentContent",
    attachmentContentSchema,
    "attachment_contents",
  );
