import { createRequire } from "node:module";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { Types } from "mongoose";

import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  attachmentExtensionMatchesDetectedMime,
  getAttachmentCategory,
  hasValidAttachmentSignature,
  MAX_ATTACHMENTS_PER_REQUEST,
} from "@/lib/constants/attachments";
import { connectToDatabase, disconnectFromDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { AppError } from "@/lib/errors";
import {
  canTransitionAttachmentProcessingStatus,
  getAvailableAttachmentProcessingTransitions,
} from "@/lib/attachment-processing";
import { detectAttachmentMimeType } from "@/services/attachment-mime.service";
import {
  calculateAttachmentChecksum,
  getAttachmentProcessingStatus,
  markAttachmentFailed,
  markAttachmentProcessed,
  markAttachmentProcessing,
  queueAttachment,
  verifyAttachmentIntegrity,
} from "@/services/attachment-processing.service";
import {
  LocalStorageProvider,
  normalizeStorageKey,
  setStorageProviderForTests,
} from "@/services/storage.service";
import {
  deleteIssueAttachment,
  getIssueAttachmentDownload,
  getIssueAttachmentMetadata,
  getMaxAttachmentSizeBytes,
  listIssueAttachments,
  retryIssueAttachment,
  uploadIssueAttachments,
} from "@/services/issue-attachment.service";
import { ActivityLog, Evidence, Issue, IssueAttachment, User, Workspace } from "@/models";
import type { IssueAttachmentDocument } from "@/models/issue-attachment.model";
import { ACTIVITY_ACTIONS, ACTIVITY_ACTION_TYPES } from "@/types/domain";
import { VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
let passed = 0;
let failed = 0;
const id = () => new Types.ObjectId();
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=",
  "base64",
);
const pdfBytes = Buffer.from("%PDF-1.7\nSolvePilot attachment test\n", "utf8");

async function thrownStatus(fn: () => Promise<unknown>): Promise<number | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.statusCode : 500;
  }
}

function makeFile(name: string, mimeType: string, bytes: Buffer): File {
  return new File([Uint8Array.from(bytes)], name, { type: mimeType });
}

async function countStoredFiles(root: string): Promise<number> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).length;
}

harness.section("Attachment categories and file signatures", [
  {
    description: "supports the specified allowlisted MIME types",
    test: () => ALLOWED_ATTACHMENT_MIME_TYPES.length === 10,
  },
  {
    description: "categorizes images, documents, spreadsheets and text",
    test: () =>
      getAttachmentCategory("image/png") === "image" &&
      getAttachmentCategory("application/pdf") === "document" &&
      getAttachmentCategory("text/csv") === "spreadsheet" &&
      getAttachmentCategory("text/plain") === "text" &&
      getAttachmentCategory("application/x-unknown") === "other",
  },
  {
    description: "accepts matching PNG, JPEG, WebP, PDF and text signatures",
    test: () =>
      hasValidAttachmentSignature("image/png", pngBytes) &&
      hasValidAttachmentSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])) &&
      hasValidAttachmentSignature("image/webp", Buffer.from("RIFF0000WEBP", "ascii")) &&
      hasValidAttachmentSignature("application/pdf", pdfBytes) &&
      hasValidAttachmentSignature("text/csv", Buffer.from("id,name\n1,Ada\n")),
  },
  {
    description: "rejects MIME/signature mismatch and executable signatures",
    test: () =>
      !hasValidAttachmentSignature("image/png", Buffer.from("not an image")) &&
      !hasValidAttachmentSignature("text/plain", Buffer.from("MZ\u0000\u0000")) &&
      !hasValidAttachmentSignature("text/plain", Buffer.from("#!/bin/sh\necho nope")),
  },
  {
    description: "caps one upload batch at five files",
    test: () => MAX_ATTACHMENTS_PER_REQUEST === 5,
  },
  {
    description: "normalizes safe storage keys and rejects traversal or absolute paths",
    test: () => {
      let traversalRejected = false;
      let absoluteRejected = false;
      try {
        normalizeStorageKey("../../etc/passwd");
      } catch {
        traversalRejected = true;
      }
      try {
        normalizeStorageKey("/private/file");
      } catch {
        absoluteRejected = true;
      }
      return (
        normalizeStorageKey("workspace/issue/random-id") === "workspace/issue/random-id" &&
        traversalRejected &&
        absoluteRejected
      );
    },
  },
  {
    description: "IssueAttachment schema requires references and file metadata",
    test: async () => {
      const valid = new IssueAttachment({
        workspaceId: id(),
        issueId: id(),
        uploadedBy: id(),
        originalName: "error.png",
        storageKey: "workspace/issue/object",
        mimeType: "image/png",
        size: pngBytes.byteLength,
        category: "image",
      });
      await valid.validate();
      const missing = new IssueAttachment({} as unknown as IssueAttachmentDocument);
      try {
        await missing.validate();
        return false;
      } catch {
        return true;
      }
    },
  },
  {
    description: "processing metadata defaults to uploaded and validates optional fields",
    test: async () => {
      const record = new IssueAttachment({
        workspaceId: id(),
        issueId: id(),
        uploadedBy: id(),
        originalName: "error.png",
        storageKey: "workspace/issue/object",
        mimeType: "image/png",
        size: pngBytes.byteLength,
        category: "image",
        checksum: calculateAttachmentChecksum(pngBytes),
        detectedMimeType: "image/png",
      });
      await record.validate();
      return record.processingStatus === "uploaded" && record.checksum?.length === 64;
    },
  },
  {
    description: "IssueAttachment rejects an unsupported category",
    test: async () => {
      const invalid = new IssueAttachment({
        workspaceId: id(),
        issueId: id(),
        uploadedBy: id(),
        originalName: "file.bin",
        storageKey: "workspace/issue/object",
        mimeType: "image/png",
        size: 10,
        category: "invalid",
      } as unknown as IssueAttachmentDocument);
      try {
        await invalid.validate();
        return false;
      } catch {
        return true;
      }
    },
  },
  {
    description: "IssueAttachment declares only the required query indexes",
    test: () => {
      const indexes = IssueAttachment.schema.indexes().map(([keys]) => Object.keys(keys).join("+"));
      const checksumIndex = IssueAttachment.schema
        .indexes()
        .find(([keys]) => Object.keys(keys).join("+") === "issueId+checksum");
      const options = checksumIndex?.[1] as
        | { unique?: boolean; partialFilterExpression?: { checksum?: { $type?: string } } }
        | undefined;
      return (
        indexes.includes("workspaceId+issueId+createdAt") &&
        indexes.includes("issueId+createdAt") &&
        indexes.includes("uploadedBy+createdAt") &&
        indexes.includes("issueId+checksum") &&
        indexes.length === 4 &&
        options?.unique === true &&
        options.partialFilterExpression?.checksum?.$type === "string"
      );
    },
  },
  {
    description: "Evidence model remains registered for later evidence tasks",
    test: () => Evidence.modelName === "Evidence",
  },
]);

harness.section("Attachment checksum and detected MIME", [
  {
    description: "SHA-256 is deterministic for identical bytes and changes with content",
    test: () =>
      calculateAttachmentChecksum(Buffer.from("actual content")) ===
        calculateAttachmentChecksum(Buffer.from("actual content")) &&
      calculateAttachmentChecksum(Buffer.from("actual content")) !==
        calculateAttachmentChecksum(Buffer.from("different content")),
  },
  {
    description: "detects valid PNG, JPEG and PDF signatures from bytes",
    test: async () =>
      (await detectAttachmentMimeType("image/png", pngBytes)) === "image/png" &&
      (await detectAttachmentMimeType("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]))) ===
        "image/jpeg" &&
      (await detectAttachmentMimeType("application/pdf", pdfBytes)) === "application/pdf",
  },
  {
    description: "rejects declared MIME mismatch, executable bytes and malformed images",
    test: async () =>
      (await thrownStatus(() => detectAttachmentMimeType("application/pdf", pngBytes))) === 415 &&
      (await thrownStatus(() =>
        detectAttachmentMimeType("text/plain", Buffer.from("MZ\u0000\u0000")),
      )) === 415 &&
      (await thrownStatus(() =>
        detectAttachmentMimeType("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      )) === 415,
  },
  {
    description:
      "a known misleading extension is rejected but extensions are not used to detect MIME",
    test: () =>
      !attachmentExtensionMatchesDetectedMime("misleading.pdf", "image/png") &&
      attachmentExtensionMatchesDetectedMime("image.png", "image/png") &&
      attachmentExtensionMatchesDetectedMime("unknown.custom", "image/png") &&
      attachmentExtensionMatchesDetectedMime("misleading.pdf", null),
  },
  {
    description: "accepts valid plain text where signature detection is unavailable",
    test: async () =>
      hasValidAttachmentSignature("text/plain", Buffer.from("plain UTF-8 notes")) &&
      (await detectAttachmentMimeType("text/plain", Buffer.from("plain UTF-8 notes"))) === null,
  },
]);

harness.section("Attachment processing status transitions", [
  {
    description: "allows exactly uploaded→queued→processing→processed/failed→queued",
    test: () =>
      canTransitionAttachmentProcessingStatus("uploaded", "queued") &&
      canTransitionAttachmentProcessingStatus("queued", "processing") &&
      canTransitionAttachmentProcessingStatus("processing", "processed") &&
      canTransitionAttachmentProcessingStatus("processing", "failed") &&
      canTransitionAttachmentProcessingStatus("failed", "queued") &&
      getAvailableAttachmentProcessingTransitions("processed").length === 0,
  },
  {
    description: "rejects unsupported and backward processing state changes",
    test: () =>
      !canTransitionAttachmentProcessingStatus("uploaded", "processed") &&
      !canTransitionAttachmentProcessingStatus("uploaded", "failed") &&
      !canTransitionAttachmentProcessingStatus("queued", "processed") &&
      !canTransitionAttachmentProcessingStatus("processed", "processing") &&
      !canTransitionAttachmentProcessingStatus("processed", "failed") &&
      !canTransitionAttachmentProcessingStatus("failed", "processed"),
  },
]);

harness.section("Attachment activity actions", [
  {
    description: "attachment added and removed actions are registered",
    test: () =>
      (ACTIVITY_ACTIONS as readonly string[]).includes("issue.attachment_added") &&
      (ACTIVITY_ACTIONS as readonly string[]).includes("issue.attachment_deleted") &&
      ACTIVITY_ACTION_TYPES.ISSUE_ATTACHMENT_ADDED === "issue.attachment_added" &&
      ACTIVITY_ACTION_TYPES.ISSUE_ATTACHMENT_DELETED === "issue.attachment_deleted",
  },
]);

harness.section("Private local storage adapter", [
  {
    description: "stores, reads, checks, and deletes files outside public/",
    test: async () => {
      const root = await mkdtemp(path.join(tmpdir(), "solvepilot-storage-"));
      const provider = new LocalStorageProvider(root);
      const key = "workspace/issue/test-object";
      try {
        const content = Buffer.from("private contents");
        await provider.upload(content, key);
        const existsAfterUpload = await provider.exists(key);
        const downloaded = await provider.getFile(key);
        await provider.delete(key);
        return (
          existsAfterUpload &&
          downloaded.equals(content) &&
          !(await provider.exists(key)) &&
          !provider.rootDirectory.includes(`${path.sep}public${path.sep}`)
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  },
]);

const staticResults = await harness.runCollecting();
passed += staticResults.passed;
failed += staticResults.failed;

if (!isDatabaseConfigured()) {
  console.log("\nLive attachment service checks");
  console.log("  · skipped: set MONGODB_URI in .env.local to run the service-level checks");
} else {
  console.log("\nLive attachment service checks");
  await connectToDatabase();
  const stamp = `${Date.now().toString(36)}-${id().toString()}`;
  const localRoot = path.resolve(process.cwd(), ".storage", `attachment-verify-${stamp}`);
  const localProvider = new LocalStorageProvider(localRoot);
  setStorageProviderForTests(localProvider);

  const owner = await User.create({
    name: "Attachment Owner",
    email: `attach-owner-${stamp}@sp.test`,
  });
  const admin = await User.create({
    name: "Attachment Admin",
    email: `attach-admin-${stamp}@sp.test`,
  });
  const member = await User.create({
    name: "Attachment Member",
    email: `attach-member-${stamp}@sp.test`,
  });
  const otherMember = await User.create({
    name: "Other Member",
    email: `attach-other-${stamp}@sp.test`,
  });
  const outsider = await User.create({
    name: "Attachment Outsider",
    email: `attach-out-${stamp}@sp.test`,
  });
  const workspaceA = await Workspace.create({
    name: "Attachment Workspace A",
    slug: `attachment-a-${stamp}`,
    ownerId: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: admin._id, role: "admin" },
      { userId: member._id, role: "member" },
      { userId: otherMember._id, role: "member" },
    ],
  });
  const workspaceB = await Workspace.create({
    name: "Attachment Workspace B",
    slug: `attachment-b-${stamp}`,
    ownerId: outsider._id,
    members: [{ userId: outsider._id, role: "owner" }],
  });

  const createIssue = async (
    workspaceId: Types.ObjectId,
    createdBy: Types.ObjectId,
    title: string,
  ) =>
    Issue.create({
      workspaceId,
      projectId: null,
      createdBy,
      assignedTo: null,
      title,
      description: "A sufficiently detailed attachment test Problem.",
      category: "other",
      status: "new",
      priority: "medium",
      source: "text",
      aiConfidence: null,
      estimatedMinutes: null,
      resolvedAt: null,
    });
  const ownerIssue = await createIssue(workspaceA._id, owner._id, "Owner attachment Problem");
  const memberIssue = await createIssue(workspaceA._id, member._id, "Member attachment Problem");
  const otherIssue = await createIssue(workspaceA._id, otherMember._id, "Other attachment Problem");
  const foreignIssue = await createIssue(
    workspaceB._id,
    outsider._id,
    "Foreign attachment Problem",
  );
  const attachmentIds: string[] = [];

  const live = new VerifyHarness();
  live.section("Attachment upload authorization and validation", [
    {
      description: "owner can upload multiple valid files and receives safe metadata",
      test: async () => {
        const added = await uploadIssueAttachments(
          String(owner._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          [
            makeFile("error.png", "image/png", pngBytes),
            makeFile("report.pdf", "application/pdf", pdfBytes),
          ],
        );
        attachmentIds.push(...added.map((item) => item.id));
        const pngRecord = await IssueAttachment.findById(added[0]?.id).lean();
        const pdfRecord = await IssueAttachment.findById(added[1]?.id).lean();
        return (
          added.length === 2 &&
          added[0]?.category === "image" &&
          added[1]?.category === "document" &&
          added[0]?.processingStatus === "uploaded" &&
          added[0]?.detectedMimeType === "image/png" &&
          added[1]?.detectedMimeType === "application/pdf" &&
          pngRecord?.checksum === calculateAttachmentChecksum(pngBytes) &&
          pdfRecord?.checksum === calculateAttachmentChecksum(pdfBytes) &&
          (await verifyAttachmentIntegrity(added[0]!.id)) &&
          added.every(
            (item) =>
              !("storageKey" in item) &&
              !("fileUrl" in item) &&
              !("text" in item) &&
              item.extractionStatus === "not_started",
          )
        );
      },
    },
    {
      description: "admin can upload to another user's Problem",
      test: async () => {
        const added = await uploadIssueAttachments(
          String(admin._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          [makeFile("admin.txt", "text/plain", Buffer.from("plain notes"))],
        );
        attachmentIds.push(...added.map((item) => item.id));
        return added.length === 1 && added[0]?.category === "text";
      },
    },
    {
      description: "a member can upload to their own Problem",
      test: async () => {
        const added = await uploadIssueAttachments(
          String(member._id),
          String(workspaceA._id),
          String(memberIssue._id),
          [makeFile("member.csv", "text/csv", Buffer.from("id,name\n1,Ada"))],
        );
        attachmentIds.push(...added.map((item) => item.id));
        return added.length === 1 && added[0]?.category === "spreadsheet";
      },
    },
    {
      description:
        "same-Problem duplicate content is rejected before storage regardless of filename",
      test: async () => {
        const beforeFiles = await countStoredFiles(localRoot);
        const beforeRecords = await IssueAttachment.countDocuments({ issueId: ownerIssue._id });
        const status = await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [makeFile("copy-of-error.png", "image/png", pngBytes)],
          ),
        );
        return (
          status === 409 &&
          (await countStoredFiles(localRoot)) === beforeFiles &&
          (await IssueAttachment.countDocuments({ issueId: ownerIssue._id })) === beforeRecords
        );
      },
    },
    {
      description: "identical content can be attached to a different Problem",
      test: async () => {
        const added = await uploadIssueAttachments(
          String(admin._id),
          String(workspaceA._id),
          String(otherIssue._id),
          [makeFile("same-content-other-issue.png", "image/png", pngBytes)],
        );
        attachmentIds.push(...added.map((item) => item.id));
        return added.length === 1 && !("storageKey" in added[0]!) && !("checksum" in added[0]!);
      },
    },
    {
      description: "a member cannot upload to another member's Problem",
      test: async () =>
        (await thrownStatus(() =>
          uploadIssueAttachments(
            String(member._id),
            String(workspaceA._id),
            String(otherIssue._id),
            [makeFile("file.png", "image/png", pngBytes)],
          ),
        )) === 403,
    },
    {
      description: "a non-member cannot upload to the workspace",
      test: async () =>
        (await thrownStatus(() =>
          uploadIssueAttachments(
            String(outsider._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [makeFile("file.png", "image/png", pngBytes)],
          ),
        )) === 404,
    },
    {
      description: "storage is rolled back when attachment metadata creation fails",
      test: async () => {
        const beforeFiles = await countStoredFiles(localRoot);
        const originalInsertMany = IssueAttachment.insertMany;
        Object.defineProperty(IssueAttachment, "insertMany", {
          configurable: true,
          writable: true,
          value: async () => {
            throw new Error("simulated database write failure");
          },
        });
        let status: number | null;
        try {
          status = await thrownStatus(() =>
            uploadIssueAttachments(
              String(owner._id),
              String(workspaceA._id),
              String(ownerIssue._id),
              [makeFile("cleanup-test.txt", "text/plain", Buffer.from("cleanup fixture"))],
            ),
          );
        } finally {
          Object.defineProperty(IssueAttachment, "insertMany", {
            configurable: true,
            writable: true,
            value: originalInsertMany,
          });
        }
        return status === 500 && (await countStoredFiles(localRoot)) === beforeFiles;
      },
    },
    {
      description: "unsupported MIME and a spoofed image signature are rejected",
      test: async () =>
        (await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [makeFile("x.exe", "application/octet-stream", Buffer.from("MZ\u0000\u0000"))],
          ),
        )) === 415 &&
        (await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [makeFile("fake.png", "image/png", Buffer.from("plain text"))],
          ),
        )) === 415 &&
        (await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [makeFile("misleading.pdf", "image/png", pngBytes)],
          ),
        )) === 415,
    },
    {
      description: "oversized and more-than-five-file uploads are rejected server-side",
      test: async () => {
        const oversized = {
          name: "large.pdf",
          type: "application/pdf",
          size: getMaxAttachmentSizeBytes() + 1,
          arrayBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer,
        } as unknown as File;
        const tooLarge = await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            [oversized],
          ),
        );
        const tooMany = await thrownStatus(() =>
          uploadIssueAttachments(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            Array.from({ length: 6 }, (_, index) =>
              makeFile(`file-${index}.png`, "image/png", pngBytes),
            ),
          ),
        );
        return tooLarge === 413 && tooMany === 400;
      },
    },
  ]);

  live.section("Attachment processing service", [
    {
      description: "service enforces uploaded→queued→processing→failed→queued→processed",
      test: async () => {
        const attachmentId = attachmentIds[0];
        if (!attachmentId) return false;
        const uploaded = await getAttachmentProcessingStatus(attachmentId);
        await queueAttachment(attachmentId);
        const queued = await getAttachmentProcessingStatus(attachmentId);
        await markAttachmentProcessing(attachmentId);
        await markAttachmentFailed(attachmentId, new Error("Synthetic processor failure"));
        const failed = await getAttachmentProcessingStatus(attachmentId);
        const memberRetry = await thrownStatus(() =>
          retryIssueAttachment(
            String(member._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            attachmentId,
          ),
        );
        const crossWorkspaceRetry = await thrownStatus(() =>
          retryIssueAttachment(
            String(owner._id),
            String(workspaceB._id),
            String(foreignIssue._id),
            attachmentId,
          ),
        );
        const retried = await retryIssueAttachment(
          String(owner._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          attachmentId,
        );
        await markAttachmentProcessing(attachmentId);
        await markAttachmentProcessed(attachmentId);
        const processed = await getAttachmentProcessingStatus(attachmentId);
        const invalidTransition = await thrownStatus(() => markAttachmentProcessing(attachmentId));
        const processedRetry = await thrownStatus(() =>
          retryIssueAttachment(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            attachmentId,
          ),
        );
        return (
          uploaded.status === "uploaded" &&
          queued.status === "queued" &&
          failed.status === "failed" &&
          failed.processingError === "Attachment processing failed." &&
          failed.processingError.length <= 1000 &&
          memberRetry === 403 &&
          crossWorkspaceRetry === 404 &&
          retried.processingStatus === "queued" &&
          processed.status === "processed" &&
          invalidTransition === 409 &&
          processedRetry === 409
        );
      },
    },
  ]);

  live.section("Attachment list, download, and delete", [
    {
      description: "authorized workspace members can list only safe attachment metadata",
      test: async () => {
        const listed = await listIssueAttachments(
          String(member._id),
          String(workspaceA._id),
          String(ownerIssue._id),
        );
        const firstId = attachmentIds[0];
        const detail = firstId
          ? await getIssueAttachmentMetadata(
              String(member._id),
              String(workspaceA._id),
              String(ownerIssue._id),
              firstId,
            )
          : null;
        const addedEvent = await ActivityLog.findOne({
          issueId: ownerIssue._id,
          action: "issue.attachment_added",
          "metadata.fileName": "error.png",
        }).lean();
        const metadata = addedEvent?.metadata as Record<string, unknown> | undefined;
        return (
          listed.length === 3 &&
          listed.every(
            (item) =>
              !("storageKey" in item) &&
              !("fileUrl" in item) &&
              !("checksum" in item) &&
              item.processingStatus !== undefined,
          ) &&
          metadata?.issueId === String(ownerIssue._id) &&
          typeof metadata.attachmentId === "string" &&
          metadata.mimeType === "image/png" &&
          metadata.size === pngBytes.byteLength &&
          !("content" in metadata) &&
          detail !== null &&
          detail.id === firstId &&
          detail.detectedMimeType === "image/png" &&
          detail.processingStatus === "processed" &&
          detail.uploadedBy.id === String(owner._id) &&
          detail.updatedAt instanceof Date &&
          !("storageKey" in detail)
        );
      },
    },
    {
      description: "authorized download returns original bytes and MIME metadata",
      test: async () => {
        const firstId = attachmentIds[0];
        if (!firstId) return false;
        const downloaded = await getIssueAttachmentDownload(
          String(member._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          firstId,
        );
        return (
          downloaded.mimeType === "image/png" &&
          downloaded.content.equals(pngBytes) &&
          downloaded.originalName === "error.png"
        );
      },
    },
    {
      description: "wrong Issue, workspace, and missing attachment IDs are not found",
      test: async () => {
        const firstId = attachmentIds[0];
        if (!firstId) return false;
        const wrongIssue = await thrownStatus(() =>
          getIssueAttachmentDownload(
            String(owner._id),
            String(workspaceA._id),
            String(otherIssue._id),
            firstId,
          ),
        );
        const wrongWorkspace = await thrownStatus(() =>
          getIssueAttachmentDownload(
            String(outsider._id),
            String(workspaceB._id),
            String(foreignIssue._id),
            firstId,
          ),
        );
        const missing = await thrownStatus(() =>
          getIssueAttachmentDownload(
            String(owner._id),
            String(workspaceA._id),
            String(ownerIssue._id),
            String(id()),
          ),
        );
        return wrongIssue === 404 && wrongWorkspace === 404 && missing === 404;
      },
    },
    {
      description: "a member cannot delete another user's attachment",
      test: async () => {
        const firstId = attachmentIds[0];
        return Boolean(
          firstId &&
          (await thrownStatus(() =>
            deleteIssueAttachment(
              String(member._id),
              String(workspaceA._id),
              String(ownerIssue._id),
              firstId,
            ),
          )) === 403,
        );
      },
    },
    {
      description: "admin can delete an attachment on another user's Problem",
      test: async () => {
        const attachmentId = attachmentIds[2];
        if (!attachmentId) return false;
        await deleteIssueAttachment(
          String(admin._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          attachmentId,
        );
        return !(await IssueAttachment.exists({ _id: new Types.ObjectId(attachmentId) }));
      },
    },
    {
      description: "owner can delete an attachment from their Problem",
      test: async () => {
        const attachmentId = attachmentIds[1];
        if (!attachmentId) return false;
        await deleteIssueAttachment(
          String(owner._id),
          String(workspaceA._id),
          String(ownerIssue._id),
          attachmentId,
        );
        return !(await IssueAttachment.exists({ _id: new Types.ObjectId(attachmentId) }));
      },
    },
    {
      description: "member can delete an attachment on their own Problem",
      test: async () => {
        const memberAttachment = await IssueAttachment.findOne({ issueId: memberIssue._id }).lean();
        if (!memberAttachment) return false;
        await deleteIssueAttachment(
          String(member._id),
          String(workspaceA._id),
          String(memberIssue._id),
          String(memberAttachment._id),
        );
        const remains = await IssueAttachment.exists({ _id: memberAttachment._id });
        const activity = await ActivityLog.findOne({
          issueId: ownerIssue._id,
          action: "issue.attachment_added",
        }).lean();
        const removedActivity = await ActivityLog.findOne({
          issueId: memberIssue._id,
          action: "issue.attachment_deleted",
          "metadata.attachmentId": String(memberAttachment._id),
        }).lean();
        const provider = new LocalStorageProvider(localRoot);
        return (
          !remains &&
          activity !== null &&
          removedActivity !== null &&
          !(await provider.exists(memberAttachment.storageKey))
        );
      },
    },
  ]);

  const liveResults = await live.runCollecting();
  passed += liveResults.passed;
  failed += liveResults.failed;

  await ActivityLog.deleteMany({ workspaceId: { $in: [workspaceA._id, workspaceB._id] } });
  await IssueAttachment.deleteMany({ workspaceId: { $in: [workspaceA._id, workspaceB._id] } });
  await Issue.deleteMany({ workspaceId: { $in: [workspaceA._id, workspaceB._id] } });
  await Workspace.deleteMany({ _id: { $in: [workspaceA._id, workspaceB._id] } });
  await User.deleteMany({
    _id: { $in: [owner._id, admin._id, member._id, otherMember._id, outsider._id] },
  });
  await rm(localRoot, { recursive: true, force: true });
  setStorageProviderForTests(null);
  await disconnectFromDatabase();
}

harness.report(passed, failed);
