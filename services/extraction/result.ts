import { limitExtractedText, normalizeExtractedText } from "@/lib/utils/normalize-extracted-text";
import type { ExtractionResult } from "@/services/extraction/types";

export function finalizeExtractionResult(options: {
  text: string;
  maxCharacters: number;
  pageCount?: number;
  truncated?: boolean;
}): ExtractionResult {
  const normalized = normalizeExtractedText(options.text);
  const limited = limitExtractedText(normalized, options.maxCharacters);
  return {
    text: limited.text,
    characterCount: limited.text.length,
    ...(options.pageCount !== undefined ? { pageCount: options.pageCount } : {}),
    truncated: Boolean(options.truncated) || limited.truncated,
  };
}
