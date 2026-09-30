import { finalizeExtractionResult } from "@/services/extraction/result";
import type {
  AttachmentExtractor,
  ExtractionOptions,
  ExtractionResult,
} from "@/services/extraction/types";

export const textExtractor: AttachmentExtractor = {
  supports: (mimeType) => mimeType === "text/plain",
  async extract(buffer: Buffer, options: ExtractionOptions): Promise<ExtractionResult> {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return finalizeExtractionResult({ text, maxCharacters: options.maxCharacters });
  },
};
