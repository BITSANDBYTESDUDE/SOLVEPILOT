import { csvExtractor } from "@/services/extraction/csv.extractor";
import { docxExtractor } from "@/services/extraction/docx.extractor";
import { pdfExtractor } from "@/services/extraction/pdf.extractor";
import { textExtractor } from "@/services/extraction/text.extractor";
import type { AttachmentExtractor } from "@/services/extraction/types";

export { csvExtractor } from "@/services/extraction/csv.extractor";
export { docxExtractor } from "@/services/extraction/docx.extractor";
export { pdfExtractor } from "@/services/extraction/pdf.extractor";
export { textExtractor } from "@/services/extraction/text.extractor";

export const ATTACHMENT_EXTRACTORS: readonly AttachmentExtractor[] = [
  textExtractor,
  csvExtractor,
  pdfExtractor,
  docxExtractor,
];

export function findAttachmentExtractor(mimeType: string): AttachmentExtractor | null {
  return ATTACHMENT_EXTRACTORS.find((extractor) => extractor.supports(mimeType)) ?? null;
}
