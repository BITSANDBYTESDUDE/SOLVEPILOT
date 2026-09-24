import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { REPORT_STATUSES, type ReportStatus } from "@/types/domain";

/**
 * Generated resolution report.
 *
 * `shareToken` is created with a cryptographically secure generator when the
 * report is shared; the public URL is `/share/<token>` and never exposes a
 * database id.
 */
export interface ReportDocument {
  issueId: Schema.Types.ObjectId;
  title: string;
  status: ReportStatus;
  /** Object-storage URL/key (or data URL in development) once rendering succeeds. */
  pdfUrl: string | null;
  storageKey: string | null;
  shareToken?: string;
  sharedAt: Date | null;
  /** Shown to the user when generation fails; no internal diagnostics. */
  failureReason: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ReportDocument>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: [...REPORT_STATUSES], default: "generating", required: true },
    pdfUrl: { type: String, trim: true, maxlength: 2048, default: null },
    storageKey: { type: String, trim: true, maxlength: 1024, default: null },
    // No default: an unshared report must not hold a null token, otherwise the
    // partial unique index below would reject the second unshared report.
    shareToken: { type: String, trim: true, maxlength: 128 },
    sharedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 1000 },
    generatedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

reportSchema.index({ issueId: 1, createdAt: -1 }, { name: "issue_recent" });
reportSchema.index({ status: 1 }, { name: "status" });
reportSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    name: "share_token_unique",
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);

export const Report: Model<ReportDocument> = registeredModel<ReportDocument>(
  "Report",
  reportSchema,
  "reports",
);
