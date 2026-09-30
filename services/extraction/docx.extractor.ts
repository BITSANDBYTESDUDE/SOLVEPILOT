import { htmlToText } from "html-to-text";
import mammoth from "mammoth";

import { finalizeExtractionResult } from "@/services/extraction/result";
import {
  ExtractionFailure,
  type AttachmentExtractor,
  type ExtractionOptions,
  type ExtractionResult,
} from "@/services/extraction/types";

export const docxExtractor: AttachmentExtractor = {
  supports: (mimeType) =>
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  async extract(buffer: Buffer, options: ExtractionOptions): Promise<ExtractionResult> {
    try {
      const converted = await mammoth.convertToHtml(
        { buffer },
        {
          externalFileAccess: false,
          ignoreEmptyParagraphs: true,
          convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
        },
      );
      const text = htmlToText(converted.value, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
          { selector: "img", format: "skip" },
          {
            selector: "table",
            format: "dataTable",
            options: { uppercaseHeaderCells: false, colSpacing: 1, rowSpacing: 0 },
          },
        ],
      });
      return finalizeExtractionResult({ text, maxCharacters: options.maxCharacters });
    } catch (error) {
      if (error instanceof ExtractionFailure) throw error;
      throw new ExtractionFailure("Unable to extract text from this DOCX document.", {
        cause: error,
      });
    }
  },
};
