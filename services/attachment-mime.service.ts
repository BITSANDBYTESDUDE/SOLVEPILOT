import "server-only";

import { fileTypeFromBuffer } from "file-type";

import { UnsupportedMediaTypeError } from "@/lib/errors";
import { isAllowedAttachmentMimeType } from "@/lib/constants/attachments";

const OOXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const OLE_MIME_TYPES = new Set(["application/msword", "application/vnd.ms-excel"]);

/**
 * Detect binary file signatures from content. Some legacy Office formats are
 * only identifiable as a generic OLE container, and OOXML documents as ZIP;
 * for those formats we preserve the existing signature validation but do not
 * claim a more specific detected MIME type than the bytes can prove.
 */
export async function detectAttachmentMimeType(
  declaredMimeType: string,
  bytes: Buffer,
): Promise<string | null> {
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected) {
    if (declaredMimeType.startsWith("image/") || declaredMimeType === "application/pdf") {
      throw new UnsupportedMediaTypeError(
        "The file content does not match its declared file type.",
      );
    }
    return null; // Text and some legacy office formats have no distinct magic.
  }

  if (detected.mime === "application/zip" && OOXML_MIME_TYPES.has(declaredMimeType)) return null;
  if (detected.mime === "application/x-cfb" && OLE_MIME_TYPES.has(declaredMimeType)) return null;

  if (!isAllowedAttachmentMimeType(detected.mime) || detected.mime !== declaredMimeType) {
    throw new UnsupportedMediaTypeError("The file content does not match its declared file type.");
  }
  return detected.mime;
}
