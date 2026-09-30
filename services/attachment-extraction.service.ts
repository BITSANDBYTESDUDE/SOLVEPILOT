import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { AttachmentContent, IssueAttachment } from "@/models";
import type { IssueAttachmentDocument } from "@/models/issue-attachment.model";
import {
  assertCanManageIssueAttachments,
  getIssueAttachmentMetadata,
} from "@/services/issue-attachment.service";
import {
  markAttachmentFailed,
  markAttachmentProcessed,
  markAttachmentProcessing,
  queueAttachment,
} from "@/services/attachment-processing.service";
import { findAttachmentExtractor } from "@/services/extraction";
import {
  ExtractionFailure,
  type ExtractionOptions,
  type ExtractionResult,
} from "@/services/extraction/types";
import { getStorageProvider } from "@/services/storage.service";
import { getServerEnv } from "@/lib/config/env";
import type { ExtractionStatus } from "@/types/domain";

const log = logger.child("attachment-extraction");
export const ATTACHMENT_EXTRACTOR_VERSION = "v1";

export interface AttachmentExtractionOutcome {
  attachmentId: string;
  status: ExtractionStatus;
  characterCount: number;
  pageCount: number | null;
  truncated: boolean;
  extractorVersion: string | null;
  extractedAt: Date | null;
  error: string | null;
}

export interface ExtractedContentView {
  attachmentId: string;
  text: string;
  characterCount: number;
  pageCount: number | null;
  truncated: boolean;
  extractorVersion: string;
  updatedAt: Date;
}

function attachmentObjectId(attachmentId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(attachmentId)) throw new NotFoundError("Attachment not found.");
  return new Types.ObjectId(attachmentId);
}

function extractionOptions(): ExtractionOptions {
  const env = getServerEnv();
  return {
    maxCharacters: env.MAX_EXTRACTED_CHARACTERS,
    maxPages: env.MAX_EXTRACTION_PAGES,
    maxRows: env.MAX_EXTRACTION_ROWS,
  };
}

function toOutcome(
  attachment: IssueAttachmentDocument & { _id: Types.ObjectId },
): AttachmentExtractionOutcome {
  return {
    attachmentId: String(attachment._id),
    status: attachment.extractionStatus ?? "not_started",
    characterCount: attachment.extractedCharacterCount ?? 0,
    pageCount: attachment.extractedPageCount ?? null,
    truncated: false,
    extractorVersion:
      attachment.extractionStatus === "completed" ? ATTACHMENT_EXTRACTOR_VERSION : null,
    extractedAt: attachment.extractedAt ?? null,
    error: attachment.extractionError ?? null,
  };
}

async function loadAttachment(attachmentId: string) {
  await connectToDatabase();
  const attachment = await IssueAttachment.findById(attachmentObjectId(attachmentId)).lean<
    (IssueAttachmentDocument & { _id: Types.ObjectId }) | null
  >();
  if (!attachment) throw new NotFoundError("Attachment not found.");
  return attachment;
}

async function updateExtractionStatus(
  attachmentId: string,
  values: {
    status: ExtractionStatus;
    error?: string | null;
    characterCount?: number;
    pageCount?: number | null;
    extractedAt?: Date | null;
  },
) {
  const set: Record<string, unknown> = { extractionStatus: values.status };
  const unset: Record<string, 1> = {};
  if (values.error) set.extractionError = values.error;
  else unset.extractionError = 1;
  if (values.characterCount !== undefined) set.extractedCharacterCount = values.characterCount;
  if (values.pageCount === null) unset.extractedPageCount = 1;
  else if (values.pageCount !== undefined) set.extractedPageCount = values.pageCount;
  if (values.extractedAt) set.extractedAt = values.extractedAt;
  else if (values.status !== "completed") unset.extractedAt = 1;

  const result = await IssueAttachment.findOneAndUpdate(
    { _id: attachmentObjectId(attachmentId) },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true },
  ).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (!result) throw new NotFoundError("Attachment not found.");
  return result;
}

async function markUnsupported(attachmentId: string, message: string) {
  const result = await IssueAttachment.findOneAndUpdate(
    {
      _id: attachmentObjectId(attachmentId),
      extractionStatus: { $ne: "processing" },
      processingStatus: { $ne: "processing" },
    },
    {
      $set: {
        extractionStatus: "unsupported",
        extractionError: message.slice(0, 1000),
        extractedCharacterCount: 0,
      },
      $unset: { extractedPageCount: 1, extractedAt: 1 },
    },
    { new: true, runValidators: true },
  ).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (result) return result;
  const current = await loadAttachment(attachmentId);
  if (current.extractionStatus === "processing") {
    throw new ConflictError("This attachment is already being extracted.");
  }
  if (current.processingStatus === "processing") {
    throw new ConflictError("This attachment is currently being processed.");
  }
  throw new NotFoundError("Attachment not found.");
}

async function claimExtraction(attachmentId: string) {
  const result = await IssueAttachment.findOneAndUpdate(
    {
      _id: attachmentObjectId(attachmentId),
      extractionStatus: { $ne: "processing" },
      processingStatus: { $ne: "processing" },
    },
    {
      $set: { extractionStatus: "processing" },
      $unset: { extractionError: 1 },
    },
    { new: true, runValidators: true },
  ).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (result) return result;

  const current = await loadAttachment(attachmentId);
  if (current.extractionStatus === "processing") {
    throw new ConflictError("This attachment is already being extracted.");
  }
  if (current.processingStatus === "processing") {
    throw new ConflictError("This attachment is currently being processed.");
  }
  throw new ConflictError("The attachment extraction status changed. Refresh and try again.");
}

async function enterProcessingStatus(
  attachment: IssueAttachmentDocument & { _id: Types.ObjectId },
) {
  if (attachment.processingStatus === "processed" || attachment.processingStatus === "processing") {
    return false;
  }
  if (attachment.processingStatus === "uploaded" || attachment.processingStatus === "failed") {
    await queueAttachment(String(attachment._id));
  }
  await markAttachmentProcessing(String(attachment._id));
  return true;
}

function safeFailureMessage(error: unknown, mimeType: string): string {
  if (error instanceof ExtractionFailure) return error.safeMessage.slice(0, 1000);
  if (mimeType === "application/pdf") return "Unable to extract text from this PDF.";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "Unable to extract text from this DOCX document.";
  }
  if (mimeType === "text/csv") return "Unable to extract text from this CSV.";
  return "Unable to extract text from this file.";
}

function logIdentifiers(attachment: IssueAttachmentDocument & { _id: Types.ObjectId }) {
  return {
    attachmentId: String(attachment._id),
    issueId: String(attachment.issueId),
    workspaceId: String(attachment.workspaceId),
  };
}

async function persistFailure(
  attachment: IssueAttachmentDocument & { _id: Types.ObjectId },
  message: string,
  pageCount?: number,
): Promise<AttachmentExtractionOutcome> {
  const updated = await updateExtractionStatus(String(attachment._id), {
    status: "failed",
    error: message,
    characterCount: 0,
    pageCount: pageCount ?? null,
  });
  return toOutcome(updated);
}

/** Internal extraction pipeline. It never returns the stored extracted text. */
export async function extractAttachmentContent(
  attachmentId: string,
): Promise<AttachmentExtractionOutcome> {
  const initial = await loadAttachment(attachmentId);
  let processingStatusOwned = false;
  let extractionClaimed = false;

  try {
    const storage = getStorageProvider();
    if (!(await storage.exists(initial.storageKey))) {
      throw new ExtractionFailure("The stored attachment is unavailable.");
    }

    if (initial.detectedMimeType && initial.detectedMimeType !== initial.mimeType) {
      throw new ExtractionFailure("The detected file type does not match its declared MIME type.");
    }
    const effectiveMimeType = initial.detectedMimeType ?? initial.mimeType;
    const image = initial.category === "image" || effectiveMimeType.startsWith("image/");
    if (image) {
      return toOutcome(
        await markUnsupported(
          String(initial._id),
          "Extraction not supported yet. OCR processing is not available yet.",
        ),
      );
    }

    const extractor = findAttachmentExtractor(effectiveMimeType);
    if (!extractor) {
      return toOutcome(
        await markUnsupported(
          String(initial._id),
          "This file type does not currently support text extraction.",
        ),
      );
    }

    const claimed = await claimExtraction(String(initial._id));
    extractionClaimed = true;
    processingStatusOwned = await enterProcessingStatus(claimed);

    const bytes = await storage.getFile(initial.storageKey);
    const result: ExtractionResult = await extractor.extract(bytes, extractionOptions());
    const content = await AttachmentContent.findOneAndUpdate(
      { attachmentId: initial._id },
      {
        $set: {
          attachmentId: initial._id,
          issueId: initial.issueId,
          workspaceId: initial.workspaceId,
          text: result.text,
          characterCount: result.characterCount,
          ...(result.pageCount !== undefined ? { pageCount: result.pageCount } : {}),
          truncated: result.truncated,
          extractorVersion: ATTACHMENT_EXTRACTOR_VERSION,
        },
        ...(result.pageCount === undefined ? { $unset: { pageCount: 1 } } : {}),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (!content) throw new Error("Extracted content could not be saved.");

    const completed = await updateExtractionStatus(String(initial._id), {
      status: "completed",
      characterCount: result.characterCount,
      ...(result.pageCount !== undefined ? { pageCount: result.pageCount } : { pageCount: null }),
      extractedAt: new Date(),
    });
    if (processingStatusOwned) await markAttachmentProcessed(String(initial._id));
    return { ...toOutcome(completed), truncated: result.truncated };
  } catch (error) {
    if (error instanceof ConflictError && !extractionClaimed) throw error;

    const safeMessage = safeFailureMessage(error, initial.detectedMimeType ?? initial.mimeType);
    log.error("attachment text extraction failed", error, logIdentifiers(initial));
    if (processingStatusOwned) {
      try {
        await markAttachmentFailed(String(initial._id), error);
      } catch (statusError) {
        log.error("attachment processing status could not be marked failed", statusError, {
          ...logIdentifiers(initial),
        });
      }
    }
    const pageCount = error instanceof ExtractionFailure ? error.pageCount : undefined;
    return persistFailure(initial, safeMessage, pageCount);
  }
}

/** Authenticated, workspace/Issue-scoped entry point used by the extraction API. */
export async function extractIssueAttachmentContent(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<AttachmentExtractionOutcome> {
  await assertCanManageIssueAttachments(userId, workspaceId, issueId);
  await getIssueAttachmentMetadata(userId, workspaceId, issueId, attachmentId);
  return extractAttachmentContent(attachmentId);
}

export async function getIssueAttachmentExtractedContent(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<ExtractedContentView> {
  await getIssueAttachmentMetadata(userId, workspaceId, issueId, attachmentId);
  await connectToDatabase();
  const content = await AttachmentContent.findOne({
    attachmentId: attachmentObjectId(attachmentId),
    issueId: new Types.ObjectId(issueId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean();
  if (!content) throw new NotFoundError("Extracted content is not available.");
  const attachment = await IssueAttachment.findOne({
    _id: content.attachmentId,
    issueId: content.issueId,
    workspaceId: content.workspaceId,
    extractionStatus: "completed",
  }).lean();
  if (!attachment) throw new ForbiddenError("Extracted content is not available.");

  return {
    attachmentId: String(content.attachmentId),
    text: content.text,
    characterCount: content.characterCount,
    pageCount: content.pageCount ?? null,
    truncated: content.truncated,
    extractorVersion: content.extractorVersion,
    updatedAt: content.updatedAt,
  };
}
