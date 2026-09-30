import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { Types } from "mongoose";

import {
  attachmentExtensionMatchesDetectedMime,
  getAttachmentCategory,
  hasValidAttachmentSignature,
  isAllowedAttachmentMimeType,
} from "@/lib/constants/attachments";
import { getServerEnv } from "@/lib/config/env";
import { connectToDatabase } from "@/lib/db/connect";
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  StorageError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { Issue, IssueAttachment, User, type IssueAttachmentDocument } from "@/models";
import type { AttachmentCategory, ExtractionStatus } from "@/types/domain";
import { createActivity } from "@/services/activity.service";
import { canEditIssue, canViewIssues } from "@/services/permission.service";
import { requireWorkspaceMember } from "@/lib/auth/workspace";
import { getStorageProvider, type StorageProvider } from "@/services/storage.service";
import { MAX_ATTACHMENTS_PER_REQUEST } from "@/lib/constants/attachments";
import {
  calculateAttachmentChecksum,
  queueAttachment,
} from "@/services/attachment-processing.service";
import { detectAttachmentMimeType } from "@/services/attachment-mime.service";

const log = logger.child("issue-attachment:service");
const EXECUTABLE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".com",
  ".msi",
  ".scr",
  ".js",
  ".mjs",
  ".cjs",
  ".vbs",
  ".hta",
  ".php",
  ".py",
  ".rb",
  ".pl",
  ".lua",
  ".wasm",
  ".bin",
  ".so",
  ".dylib",
  ".apk",
  ".app",
  ".elf",
  ".jar",
]);

export interface IssueAttachmentView {
  id: string;
  workspaceId: string;
  issueId: string;
  originalName: string;
  mimeType: string;
  size: number;
  detectedMimeType: string | null;
  category: AttachmentCategory;
  processingStatus: IssueAttachmentDocument["processingStatus"];
  extractionStatus: ExtractionStatus;
  extractedCharacterCount: number | null;
  extractedPageCount: number | null;
  extractionError: string | null;
  extractedAt: Date | null;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
  createdAt: Date;
  updatedAt: Date;
}

export interface AttachmentDownload {
  originalName: string;
  mimeType: string;
  size: number;
  category: AttachmentCategory;
  content: Buffer;
}

interface ValidatedUpload {
  bytes: Buffer;
  originalName: string;
  mimeType: string;
  detectedMimeType: string | null;
  checksum: string;
  category: AttachmentCategory;
}

export function getMaxAttachmentSizeBytes(): number {
  return getServerEnv().MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
}

function safeOriginalName(input: string): string {
  const normalized = path.basename(input.replaceAll("\\", "/"));
  const cleaned = normalized
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .slice(0, 255);
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new ValidationError("A valid filename is required.");
  }
  return cleaned;
}

async function validateFiles(files: File[]): Promise<ValidatedUpload[]> {
  if (files.length === 0) throw new ValidationError("Select at least one file to upload.");
  if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
    throw new ValidationError(
      `You can upload up to ${MAX_ATTACHMENTS_PER_REQUEST} files at a time.`,
    );
  }

  const maxBytes = getMaxAttachmentSizeBytes();
  const maxMb = getServerEnv().MAX_ATTACHMENT_SIZE_MB;
  const validated: ValidatedUpload[] = [];

  for (const file of files) {
    if (!file.name.trim()) throw new ValidationError("A valid filename is required.");
    if (file.size < 1) throw new ValidationError("Empty files cannot be uploaded.");
    if (file.size > maxBytes) {
      throw new PayloadTooLargeError(`This file exceeds the ${maxMb} MB limit.`);
    }

    const normalizedName = safeOriginalName(file.name);
    const extension = path.extname(normalizedName).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.has(extension)) {
      throw new UnsupportedMediaTypeError("This file type is not supported.");
    }

    const mimeType = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
    if (!isAllowedAttachmentMimeType(mimeType)) {
      throw new UnsupportedMediaTypeError("This file type is not supported.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      throw new ValidationError("The uploaded file is invalid.");
    }
    if (bytes.byteLength > maxBytes) {
      throw new PayloadTooLargeError(`This file exceeds the ${maxMb} MB limit.`);
    }
    if (!hasValidAttachmentSignature(mimeType, bytes)) {
      throw new UnsupportedMediaTypeError("This file type is not supported.");
    }

    let detectedMimeType: string | null;
    try {
      detectedMimeType = await detectAttachmentMimeType(mimeType, bytes);
    } catch (error) {
      log.warn("attachment MIME detection rejected content", {
        declaredMimeType: mimeType,
        fileSize: bytes.byteLength,
        error: error instanceof Error ? error.message : "detection failed",
      });
      throw error;
    }
    if (!attachmentExtensionMatchesDetectedMime(normalizedName, detectedMimeType)) {
      throw new UnsupportedMediaTypeError(
        "The file extension does not match its detected content type.",
      );
    }

    validated.push({
      bytes,
      originalName: normalizedName,
      mimeType,
      detectedMimeType,
      checksum: calculateAttachmentChecksum(bytes),
      category: getAttachmentCategory(mimeType),
    });
  }
  return validated;
}

function toView(
  attachment: IssueAttachmentDocument & { _id: Types.ObjectId },
  uploader: { id: string; name: string; avatarUrl: string | null },
): IssueAttachmentView {
  return {
    id: String(attachment._id),
    workspaceId: String(attachment.workspaceId),
    issueId: String(attachment.issueId),
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    detectedMimeType: attachment.detectedMimeType ?? null,
    size: attachment.size,
    category: attachment.category,
    processingStatus: attachment.processingStatus ?? "uploaded",
    extractionStatus: attachment.extractionStatus ?? "not_started",
    extractedCharacterCount: attachment.extractedCharacterCount ?? null,
    extractedPageCount: attachment.extractedPageCount ?? null,
    extractionError: attachment.extractionError ?? null,
    extractedAt: attachment.extractedAt ?? null,
    uploadedBy: uploader,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

async function findIssueForMember(userId: string, workspaceId: string, issueId: string) {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);
  if (!Types.ObjectId.isValid(issueId)) throw new NotFoundError("Problem not found.");
  await connectToDatabase();
  const issue = await Issue.findOne({
    _id: new Types.ObjectId(issueId),
    workspaceId: new Types.ObjectId(workspaceId),
  });
  if (!issue) throw new NotFoundError("Problem not found.");
  return { issue, membership };
}

/** Authorization gate called before multipart parsing and again by the mutation. */
export async function assertCanManageIssueAttachments(
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<void> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canEditIssue(membership.role, String(issue.createdBy), userId)) {
    throw new ForbiddenError("You don't have permission to manage attachments for this problem.");
  }
}

export async function listIssueAttachments(
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<IssueAttachmentView[]> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canViewIssues(membership.role)) {
    throw new ForbiddenError("You do not have permission to view this problem.");
  }

  const records = await IssueAttachment.find({
    workspaceId: new Types.ObjectId(workspaceId),
    issueId: issue._id,
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean<Array<IssueAttachmentDocument & { _id: Types.ObjectId }>>();

  const uploaderIds = [...new Set(records.map((record) => String(record.uploadedBy)))];
  const users = uploaderIds.length
    ? await User.find({ _id: { $in: uploaderIds } })
        .select("_id name avatarUrl")
        .lean<Array<{ _id: Types.ObjectId; name: string; avatarUrl?: string | null }>>()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return records.map((record) => {
    const user = userMap.get(String(record.uploadedBy));
    return toView(record, {
      id: String(record.uploadedBy),
      name: user?.name ?? "Former Member",
      avatarUrl: user?.avatarUrl ?? null,
    });
  });
}

export async function getIssueAttachmentMetadata(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<IssueAttachmentView> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canViewIssues(membership.role)) {
    throw new ForbiddenError("You do not have permission to view this problem.");
  }
  if (!Types.ObjectId.isValid(attachmentId)) throw new NotFoundError("Attachment not found.");

  const attachment = await IssueAttachment.findOne({
    _id: new Types.ObjectId(attachmentId),
    workspaceId: issue.workspaceId,
    issueId: issue._id,
  }).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (!attachment) throw new NotFoundError("Attachment not found.");

  const user = await User.findById(attachment.uploadedBy)
    .select("_id name avatarUrl")
    .lean<{ _id: Types.ObjectId; name: string; avatarUrl?: string | null } | null>();
  return toView(attachment, {
    id: String(attachment.uploadedBy),
    name: user?.name ?? "Former Member",
    avatarUrl: user?.avatarUrl ?? null,
  });
}

export async function retryIssueAttachment(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<IssueAttachmentView> {
  await assertCanManageIssueAttachments(userId, workspaceId, issueId);
  const attachment = await getIssueAttachmentMetadata(userId, workspaceId, issueId, attachmentId);
  if (attachment.processingStatus !== "failed") {
    throw new ConflictError("Only failed attachments can be retried.");
  }
  await queueAttachment(attachmentId);
  return getIssueAttachmentMetadata(userId, workspaceId, issueId, attachmentId);
}

export async function uploadIssueAttachments(
  userId: string,
  workspaceId: string,
  issueId: string,
  files: File[],
): Promise<IssueAttachmentView[]> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canEditIssue(membership.role, String(issue.createdBy), userId)) {
    throw new ForbiddenError("You don't have permission to manage attachments for this problem.");
  }

  const uploads = await validateFiles(files);
  const seenChecksums = new Set<string>();
  for (const upload of uploads) {
    if (seenChecksums.has(upload.checksum)) {
      throw new ConflictError("This file is already attached to this problem.");
    }
    seenChecksums.add(upload.checksum);
  }
  const duplicate = await IssueAttachment.exists({
    issueId: issue._id,
    checksum: { $in: uploads.map((upload) => upload.checksum) },
  });
  if (duplicate) {
    throw new ConflictError("This file is already attached to this problem.");
  }

  const currentUser = await User.findById(userId)
    .select("_id name avatarUrl")
    .lean<{ _id: Types.ObjectId; name: string; avatarUrl?: string | null } | null>();
  const uploader = {
    id: userId,
    name: currentUser?.name ?? "Workspace member",
    avatarUrl: currentUser?.avatarUrl ?? null,
  };
  const storage = getStorageProvider();
  const storedKeys: string[] = [];
  const uploadRecords = uploads.map((upload) => {
    const storageKey = `${workspaceId}/${issueId}/${randomUUID()}`;
    return { upload, storageKey };
  });

  try {
    for (const { upload, storageKey } of uploadRecords) {
      // Track before attempting the write so partially written objects are rolled back too.
      storedKeys.push(storageKey);
      await storage.upload(upload.bytes, storageKey, upload.mimeType);
    }
  } catch (error) {
    await cleanupStoredFiles(storage, storedKeys);
    log.error("attachment bytes could not be stored", error, { workspaceId, issueId, userId });
    throw new StorageError("Unable to upload this file.", error);
  }

  let persisted: Array<IssueAttachmentDocument & { _id: Types.ObjectId }>;
  try {
    persisted = (await IssueAttachment.insertMany(
      uploadRecords.map(({ upload, storageKey }) => ({
        workspaceId: issue.workspaceId,
        issueId: issue._id,
        uploadedBy: new Types.ObjectId(userId),
        originalName: upload.originalName,
        storageKey,
        mimeType: upload.mimeType,
        detectedMimeType: upload.detectedMimeType ?? undefined,
        checksum: upload.checksum,
        processingStatus: "uploaded",
        size: upload.bytes.byteLength,
        category: upload.category,
      })),
    )) as Array<IssueAttachmentDocument & { _id: Types.ObjectId }>;
  } catch (error) {
    try {
      await IssueAttachment.deleteMany({
        storageKey: { $in: storedKeys },
        workspaceId: issue.workspaceId,
      });
    } catch (cleanupError) {
      log.error("attachment metadata rollback failed", cleanupError, { workspaceId, issueId });
    }
    await cleanupStoredFiles(storage, storedKeys);
    log.error("attachment metadata could not be stored", error, { workspaceId, issueId, userId });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new ConflictError("This file is already attached to this problem.");
    }
    throw new InternalError("Unable to save attachment information.", error);
  }

  for (const attachment of persisted) {
    await createActivity({
      workspaceId,
      actorId: userId,
      action: "issue.attachment_added",
      issueId,
      metadata: {
        issueId,
        attachmentId: String(attachment._id),
        fileName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      },
    });
  }

  return persisted.map((record) => toView(record, uploader));
}

async function cleanupStoredFiles(storage: StorageProvider, keys: string[]): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  for (const result of results) {
    if (result.status === "rejected") {
      log.error("failed to roll back an uploaded attachment", result.reason);
    }
  }
}

export async function getIssueAttachmentDownload(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<AttachmentDownload> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canViewIssues(membership.role)) {
    throw new ForbiddenError("You do not have permission to view this problem.");
  }
  if (!Types.ObjectId.isValid(attachmentId)) throw new NotFoundError("Attachment not found.");

  const attachment = await IssueAttachment.findOne({
    _id: new Types.ObjectId(attachmentId),
    workspaceId: issue.workspaceId,
    issueId: issue._id,
  }).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (!attachment) throw new NotFoundError("Attachment not found.");

  let content: Buffer;
  try {
    content = await getStorageProvider().getFile(attachment.storageKey);
  } catch (error) {
    log.error("stored attachment could not be read", error, {
      workspaceId,
      issueId,
      attachmentId,
    });
    throw new StorageError("The attachment is temporarily unavailable.", error);
  }

  return {
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    category: attachment.category,
    content,
  };
}

export async function deleteIssueAttachment(
  userId: string,
  workspaceId: string,
  issueId: string,
  attachmentId: string,
): Promise<void> {
  const { issue, membership } = await findIssueForMember(userId, workspaceId, issueId);
  if (!canEditIssue(membership.role, String(issue.createdBy), userId)) {
    throw new ForbiddenError("You don't have permission to manage attachments for this problem.");
  }
  if (!Types.ObjectId.isValid(attachmentId)) throw new NotFoundError("Attachment not found.");

  const attachment = await IssueAttachment.findOne({
    _id: new Types.ObjectId(attachmentId),
    workspaceId: issue.workspaceId,
    issueId: issue._id,
  }).lean<(IssueAttachmentDocument & { _id: Types.ObjectId }) | null>();
  if (!attachment) throw new NotFoundError("Attachment not found.");

  const storage = getStorageProvider();
  try {
    if (await storage.exists(attachment.storageKey)) {
      await storage.delete(attachment.storageKey);
    } else {
      log.warn("attachment record referenced a missing storage object", {
        workspaceId,
        issueId,
        attachmentId,
      });
    }
  } catch (error) {
    log.error("stored attachment could not be deleted", error, {
      workspaceId,
      issueId,
      attachmentId,
    });
    throw new StorageError("Unable to remove this attachment right now.", error);
  }

  let removed: { deletedCount: number };
  try {
    removed = await IssueAttachment.deleteOne({
      _id: attachment._id,
      workspaceId: issue.workspaceId,
      issueId: issue._id,
    });
  } catch (error) {
    log.error("attachment metadata delete failed after storage removal", error, {
      workspaceId,
      issueId,
      attachmentId,
    });
    throw new InternalError("Unable to remove this attachment.", error);
  }
  if (removed.deletedCount !== 1) throw new NotFoundError("Attachment not found.");

  await createActivity({
    workspaceId,
    actorId: userId,
    action: "issue.attachment_deleted",
    issueId,
    metadata: {
      issueId,
      attachmentId: String(attachment._id),
      fileName: attachment.originalName,
    },
  });
}
