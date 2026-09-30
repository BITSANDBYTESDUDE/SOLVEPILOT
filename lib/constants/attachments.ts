import type { AttachmentCategory } from "@/types/domain";

export const MAX_ATTACHMENTS_PER_REQUEST = 5;
export const DEFAULT_ATTACHMENT_SIZE_MB = 25;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

const EXPECTED_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

/** Extension is only an additional mismatch signal, never MIME detection. */
export function attachmentExtensionMatchesDetectedMime(
  filename: string,
  detectedMimeType: string | null,
): boolean {
  if (!detectedMimeType) return true;
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const expected = EXPECTED_MIME_BY_EXTENSION[extension];
  return !expected || expected === detectedMimeType;
}

const CATEGORY_BY_MIME: Record<AllowedAttachmentMimeType, AttachmentCategory> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "text/csv": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "text/plain": "text",
};

export function isAllowedAttachmentMimeType(value: string): value is AllowedAttachmentMimeType {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value);
}

export function getAttachmentCategory(mimeType: string): AttachmentCategory {
  return isAllowedAttachmentMimeType(mimeType) ? CATEGORY_BY_MIME[mimeType] : "other";
}

/** Detect common file signatures and reject mismatches with the declared MIME. */
export function hasValidAttachmentSignature(mimeType: string, bytes: Buffer): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const isZip = bytes.length >= 4 && startsWith(0x50, 0x4b, 0x03, 0x04);
  const isOle = startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  const isExecutableSignature =
    startsWith(0x4d, 0x5a) || // Windows PE
    startsWith(0x7f, 0x45, 0x4c, 0x46) || // ELF
    startsWith(0xcf, 0xfa, 0xed, 0xfe) || // Mach-O
    startsWith(0xfe, 0xed, 0xfa, 0xcf);
  if (isExecutableSignature) return false;

  switch (mimeType) {
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      );
    case "application/pdf":
      return bytes.toString("ascii", 0, 5) === "%PDF-";
    case "application/msword":
    case "application/vnd.ms-excel":
      return isOle;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return isZip;
    case "text/csv":
    case "text/plain": {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        const initialText = text.trimStart().slice(0, 256).toLowerCase();
        const looksLikeScript =
          initialText.startsWith("#!") ||
          initialText.startsWith("@echo off") ||
          initialText.startsWith("<script") ||
          initialText.startsWith("<?php") ||
          initialText.startsWith("<%") ||
          initialText.startsWith("powershell -");
        return !text.includes("\0") && !looksLikeScript;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}
