import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { normalizeExtractedText } from "@/lib/utils/normalize-extracted-text";
import { finalizeExtractionResult } from "@/services/extraction/result";
import {
  ExtractionFailure,
  type AttachmentExtractor,
  type ExtractionOptions,
  type ExtractionResult,
} from "@/services/extraction/types";

export const pdfExtractor: AttachmentExtractor = {
  supports: (mimeType) => mimeType === "application/pdf",
  async extract(buffer: Buffer, options: ExtractionOptions): Promise<ExtractionResult> {
    const loadingTask = getDocument({
      data: Uint8Array.from(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
      stopAtErrors: true,
      verbosity: 0,
    });

    try {
      const document = await loadingTask.promise;
      const pageCount = document.numPages;
      if (pageCount > options.maxPages) {
        throw new ExtractionFailure("Document exceeds the maximum supported page count.", {
          pageCount,
        });
      }

      const parts: string[] = [];
      let characterCount = 0;
      let truncated = false;
      let pagesWithText = 0;

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageParts = [`${pageNumber === 1 ? "" : "\n\n"}[Page ${pageNumber}]\n`];

        for (const item of content.items) {
          if (!("str" in item) || typeof item.str !== "string") continue;
          pageParts.push(item.str);
          pageParts.push(item.hasEOL ? "\n" : " ");
        }

        const pageText = pageParts.join("");
        if (pageText.replace(/\[Page \d+\]/g, "").trim()) pagesWithText += 1;
        const remaining = options.maxCharacters - characterCount;
        if (remaining <= 0) {
          truncated = true;
          break;
        }
        if (pageText.length > remaining) {
          parts.push(pageText.slice(0, remaining));
          characterCount += remaining;
          truncated = true;
          break;
        }
        parts.push(pageText);
        characterCount += pageText.length;
        page.cleanup();
      }

      const normalized = normalizeExtractedText(parts.join(""));
      if (pagesWithText === 0) {
        throw new ExtractionFailure(
          "No extractable text was found in this PDF. OCR processing is not available yet.",
          { pageCount },
        );
      }

      return finalizeExtractionResult({
        text: normalized,
        pageCount,
        maxCharacters: options.maxCharacters,
        truncated,
      });
    } catch (error) {
      if (error instanceof ExtractionFailure) throw error;
      throw new ExtractionFailure("Unable to extract text from this PDF.", { cause: error });
    } finally {
      try {
        await loadingTask.destroy();
      } catch {
        // Best-effort cleanup must not replace the controlled extraction result.
      }
    }
  },
};
