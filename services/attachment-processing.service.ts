import "server-only";

import { createHash } from "node:crypto";
import { Types } from "mongoose";

import { canTransitionAttachmentProcessingStatus } from "@/lib/attachment-processing";
import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { IssueAttachment, type IssueAttachmentDocument } from "@/models";
import { getStorageProvider } from "@/services/storage.service";
import type { AttachmentProcessingStatus } from "@/types/domain";

const log = logger.child("attachment-processing");

export function calculateAttachmentChecksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function objectId(attachmentId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(attachmentId)) {
    throw new NotFoundError("Attachment not found.");
  }
  return new Types.ObjectId(attachmentId);
}

async function findAttachment(attachmentId: string) {
  await connectToDatabase();
  const attachment = await IssueAttachment.findById(objectId(attachmentId));
  if (!attachment) throw new NotFoundError("Attachment not found.");
  return attachment;
}

export async function getAttachmentProcessingStatus(attachmentId: string): Promise<{
  id: string;
  status: AttachmentProcessingStatus;
  processingError?: string;
  updatedAt: Date;
}> {
  const attachment = await findAttachment(attachmentId);
  return {
    id: String(attachment._id),
    status: attachment.processingStatus,
    ...(attachment.processingError ? { processingError: attachment.processingError } : {}),
    updatedAt: attachment.updatedAt,
  };
}

async function transitionAttachment(
  attachmentId: string,
  nextStatus: AttachmentProcessingStatus,
  processingError?: string,
): Promise<IssueAttachmentDocument & { _id: Types.ObjectId }> {
  const id = objectId(attachmentId);
  await connectToDatabase();
  const current = await IssueAttachment.findById(id).lean<
    (IssueAttachmentDocument & { _id: Types.ObjectId }) | null
  >();
  if (!current) throw new NotFoundError("Attachment not found.");

  if (!canTransitionAttachmentProcessingStatus(current.processingStatus, nextStatus)) {
    log.warn("attachment processing status transition rejected", {
      attachmentId,
      issueId: String(current.issueId),
      workspaceId: String(current.workspaceId),
      currentStatus: current.processingStatus,
      requestedStatus: nextStatus,
    });
    throw new ConflictError("This attachment cannot move to that processing status.");
  }

  const updated = await IssueAttachment.findOneAndUpdate(
    { _id: id, processingStatus: current.processingStatus },
    {
      $set: {
        processingStatus: nextStatus,
        ...(nextStatus === "failed" ? { processingError } : {}),
      },
      ...(nextStatus === "failed" ? {} : { $unset: { processingError: 1 } }),
    },
    { new: true, runValidators: true },
  ).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();

  if (!updated) {
    throw new ConflictError("The attachment processing status changed. Refresh and try again.");
  }
  return updated;
}

export async function queueAttachment(attachmentId: string) {
  return transitionAttachment(attachmentId, "queued");
}

export async function markAttachmentProcessing(attachmentId: string) {
  return transitionAttachment(attachmentId, "processing");
}

export async function markAttachmentProcessed(attachmentId: string) {
  return transitionAttachment(attachmentId, "processed");
}

/**
 * Keep potentially sensitive or implementation-specific details out of MongoDB.
 * Detailed errors stay in the server log; the record receives a fixed safe note.
 */
export async function markAttachmentFailed(attachmentId: string, error: unknown) {
  const current = await findAttachment(attachmentId);
  if (current.processingStatus !== "processing") {
    return transitionAttachment(attachmentId, "failed", "Attachment processing failed.");
  }
  log.error("attachment processing failed", error, {
    attachmentId: String(current._id),
    issueId: String(current.issueId),
    workspaceId: String(current.workspaceId),
  });
  return transitionAttachment(attachmentId, "failed", "Attachment processing failed.");
}

/** Read storage through the configured provider; never run on normal page loads. */
export async function verifyAttachmentIntegrity(attachmentId: string): Promise<boolean> {
  const attachment = await findAttachment(attachmentId);
  if (!attachment.checksum) return false;

  try {
    const bytes = await getStorageProvider().getFile(attachment.storageKey);
    const actualChecksum = calculateAttachmentChecksum(bytes);
    const matches = actualChecksum === attachment.checksum;
    if (!matches) {
      log.error("attachment checksum did not match stored metadata", undefined, {
        attachmentId: String(attachment._id),
        issueId: String(attachment.issueId),
        workspaceId: String(attachment.workspaceId),
      });
    }
    return matches;
  } catch (error) {
    log.error("attachment integrity check could not read stored content", error, {
      attachmentId: String(attachment._id),
      issueId: String(attachment.issueId),
      workspaceId: String(attachment.workspaceId),
    });
    return false;
  }
}
