import { Readable } from "node:stream";

import { parse } from "csv-parse";

import { finalizeExtractionResult } from "@/services/extraction/result";
import {
  ExtractionFailure,
  type AttachmentExtractor,
  type ExtractionOptions,
  type ExtractionResult,
} from "@/services/extraction/types";

const MAX_CSV_RECORD_CHARACTERS = 1_000_000;

function isStringRecord(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((cell): cell is string => typeof cell === "string");
}

function formatCell(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\n\s*/g, " ")
    .replaceAll("|", "\\|");
}

export const csvExtractor: AttachmentExtractor = {
  supports: (mimeType) => mimeType === "text/csv",
  async extract(buffer: Buffer, options: ExtractionOptions): Promise<ExtractionResult> {
    const csvText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const parser = Readable.from([csvText]).pipe(
      parse({
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        max_record_size: MAX_CSV_RECORD_CHARACTERS,
      }),
    );

    const output: string[] = [];
    let characterCount = 0;
    let rowsProcessed = 0;
    let truncated = false;

    try {
      for await (const value of parser as AsyncIterable<unknown>) {
        if (!isStringRecord(value)) continue;
        if (rowsProcessed >= options.maxRows) {
          truncated = true;
          break;
        }

        const row = value.map((cell) => formatCell(String(cell ?? ""))).join(" | ");
        const addition = `${rowsProcessed > 0 ? "\n" : ""}${row}`;
        const remaining = options.maxCharacters - characterCount;

        if (remaining <= 0) {
          truncated = true;
          break;
        }
        if (addition.length > remaining) {
          output.push(addition.slice(0, remaining));
          characterCount += remaining;
          truncated = true;
          break;
        }

        output.push(addition);
        characterCount += addition.length;
        rowsProcessed += 1;
      }
    } catch (error) {
      throw new ExtractionFailure(
        error instanceof Error && "code" in error && error.code === "CSV_MAX_RECORD_SIZE"
          ? "This CSV contains a row that is too large to extract."
          : "Unable to extract text from this CSV.",
        { cause: error },
      );
    } finally {
      parser.destroy();
    }

    return finalizeExtractionResult({
      text: output.join(""),
      maxCharacters: options.maxCharacters,
      truncated,
    });
  },
};
