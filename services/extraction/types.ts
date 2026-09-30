export interface ExtractionResult {
  text: string;
  characterCount: number;
  pageCount?: number;
  truncated: boolean;
}

export interface ExtractionOptions {
  maxCharacters: number;
  maxPages: number;
  maxRows: number;
}

export interface AttachmentExtractor {
  supports(mimeType: string): boolean;
  extract(buffer: Buffer, options: ExtractionOptions): Promise<ExtractionResult>;
}

/** An error whose message is already suitable for persistence and API display. */
export class ExtractionFailure extends Error {
  readonly safeMessage: string;
  readonly pageCount?: number;

  constructor(safeMessage: string, options?: { pageCount?: number; cause?: unknown }) {
    super(safeMessage, { cause: options?.cause });
    this.name = "ExtractionFailure";
    this.safeMessage = safeMessage;
    this.pageCount = options?.pageCount;
  }
}
