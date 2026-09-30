import { createRequire } from "node:module";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { zipSync, strToU8 } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Types } from "mongoose";

import { normalizeExtractedText } from "@/lib/utils/normalize-extracted-text";
import { connectToDatabase, disconnectFromDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { AppError } from "@/lib/errors";
import {
  csvExtractor,
  docxExtractor,
  findAttachmentExtractor,
  pdfExtractor,
  textExtractor,
} from "@/services/extraction";
import { ExtractionFailure, type ExtractionOptions } from "@/services/extraction/types";
import {
  extractIssueAttachmentContent,
  getIssueAttachmentExtractedContent,
} from "@/services/attachment-extraction.service";
import { LocalStorageProvider, setStorageProviderForTests } from "@/services/storage.service";
import { AttachmentContent, Issue, IssueAttachment, User, Workspace } from "@/models";
import { VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const id = () => new Types.ObjectId();
const defaultOptions: ExtractionOptions = {
  maxCharacters: 500_000,
  maxPages: 200,
  maxRows: 10_000,
};

function throwsStatus(fn: () => Promise<unknown>): Promise<number | null> {
  return fn()
    .then(() => null)
    .catch((error: unknown) => (error instanceof AppError ? error.statusCode : 500));
}

async function createPdf(pages: Array<string | null>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const content of pages) {
    const page = pdf.addPage([612, 792]);
    if (content) page.drawText(content, { x: 48, y: 720, size: 12, font });
  }
  return Buffer.from(await pdf.save());
}

function createDocx(documentBody: string): Buffer {
  const entries: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBody}<w:sectPr/></w:body></w:document>`,
    ),
  };
  return Buffer.from(zipSync(entries));
}

const text = (value: string) => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`;
const heading = (value: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${value}</w:t></w:r></w:p>`;
const table =
  "<w:tbl><w:tblPr/><w:tblGrid/><w:tr><w:tc><w:p><w:r><w:t>Browser</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Version</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Chrome</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>154</w:t></w:r></w:p></w:tc></w:tr></w:tbl>";

harness.section("Extractor strategy selection", [
  {
    description: "selects only TXT, CSV, PDF, and DOCX text extractors; images remain unsupported",
    test: () =>
      findAttachmentExtractor("text/plain") !== null &&
      findAttachmentExtractor("text/csv") !== null &&
      findAttachmentExtractor("application/pdf") !== null &&
      findAttachmentExtractor(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ) !== null &&
      findAttachmentExtractor("image/png") === null &&
      findAttachmentExtractor("application/vnd.ms-excel") === null,
  },
]);

harness.section("Plain text extraction and normalization", [
  {
    description: "normalizes line endings, repeated whitespace, nulls, and control characters",
    test: () =>
      normalizeExtractedText("\u0000Title  \r\n\r\n\r\n body\u0007\t text  ") ===
      "Title\n\n body text",
  },
  {
    description: "extracts UTF-8 multiline text and replaces malformed byte sequences safely",
    test: async () => {
      const normal = await textExtractor.extract(
        Buffer.from("Hello, SolvePilot\nSecond paragraph", "utf8"),
        defaultOptions,
      );
      const malformed = await textExtractor.extract(
        Buffer.from([0xff, 0xfe, 0x41]),
        defaultOptions,
      );
      return (
        normal.text === "Hello, SolvePilot\nSecond paragraph" &&
        normal.characterCount === normal.text.length &&
        malformed.text.includes("\uFFFD") &&
        malformed.text.includes("A")
      );
    },
  },
  {
    description: "preserves script-looking text as text for escaped client rendering",
    test: async () => {
      const extracted = await textExtractor.extract(
        Buffer.from("<script>alert('no')</script>", "utf8"),
        defaultOptions,
      );
      const componentSource = await readFile(
        path.join(process.cwd(), "components/issues/issue-attachments.tsx"),
        "utf8",
      );
      return (
        extracted.text.includes("<script>") &&
        componentSource.includes("{extractedContent.text}") &&
        !componentSource.includes("dangerouslySetInnerHTML")
      );
    },
  },
  {
    description: "truncates text at the configured character cap and reports it",
    test: async () => {
      const result = await textExtractor.extract(Buffer.from("abcdefghijklmnop"), {
        ...defaultOptions,
        maxCharacters: 8,
      });
      return result.text === "abcdefgh" && result.characterCount === 8 && result.truncated;
    },
  },
]);

harness.section("CSV extraction", [
  {
    description: "converts headers, quoted commas, quoted quotes, and empty cells to readable rows",
    test: async () => {
      const result = await csvExtractor.extract(
        Buffer.from('name,note,status\nAli,"works, now",active\nSara,"say ""hello""",\n'),
        defaultOptions,
      );
      return (
        result.text.includes("name | note | status") &&
        result.text.includes("Ali | works, now | active") &&
        result.text.includes('Sara | say "hello" |') &&
        !result.truncated
      );
    },
  },
  {
    description: "respects row and output-character limits and marks incomplete results truncated",
    test: async () => {
      const csv = Buffer.from("name,value\nA,1\nB,2\nC,3\n");
      const byRows = await csvExtractor.extract(csv, { ...defaultOptions, maxRows: 2 });
      const byCharacters = await csvExtractor.extract(csv, {
        ...defaultOptions,
        maxCharacters: 12,
      });
      return (
        byRows.truncated &&
        byRows.text.includes("A | 1") &&
        !byRows.text.includes("B | 2") &&
        byCharacters.truncated &&
        byCharacters.characterCount <= 12
      );
    },
  },
  {
    description: "returns a controlled failure for malformed quoted CSV",
    test: async () => {
      try {
        await csvExtractor.extract(Buffer.from('name,note\nAli,"missing quote'), defaultOptions);
        return false;
      } catch (error) {
        return (
          error instanceof ExtractionFailure && error.safeMessage.includes("Unable to extract")
        );
      }
    },
  },
  {
    description: "streams a moderately large CSV while keeping output bounded",
    test: async () => {
      const lines = ["id,value", ...Array.from({ length: 3000 }, (_, i) => `${i},row-${i}`)];
      const result = await csvExtractor.extract(Buffer.from(lines.join("\n")), {
        ...defaultOptions,
        maxRows: 2500,
        maxCharacters: 80_000,
      });
      return (
        result.truncated &&
        result.characterCount <= 80_000 &&
        result.text.includes("2498 | row-2498")
      );
    },
  },
]);

harness.section("PDF extraction", [
  {
    description: "extracts text and preserves page boundaries and page count",
    test: async () => {
      const bytes = await createPdf(["Checkout returns HTTP 500", "Only in production"]);
      const result = await pdfExtractor.extract(bytes, defaultOptions);
      return (
        result.pageCount === 2 &&
        result.characterCount === result.text.length &&
        result.text.includes("[Page 1]") &&
        result.text.includes("[Page 2]") &&
        result.text.indexOf("[Page 1]") < result.text.indexOf("[Page 2]") &&
        result.text.includes("Checkout returns HTTP 500") &&
        !result.truncated
      );
    },
  },
  {
    description: "reports blank/scanned PDFs as failed-extraction candidates without OCR",
    test: async () => {
      try {
        await pdfExtractor.extract(await createPdf([null]), defaultOptions);
        return false;
      } catch (error) {
        return (
          error instanceof ExtractionFailure &&
          error.safeMessage.includes("No extractable text") &&
          error.safeMessage.includes("OCR processing is not available yet") &&
          error.pageCount === 1
        );
      }
    },
  },
  {
    description: "rejects PDFs over the configured page limit and truncates over-limit text",
    test: async () => {
      const bytes = await createPdf(["page one words", "page two words"]);
      let pageLimit = false;
      try {
        await pdfExtractor.extract(bytes, { ...defaultOptions, maxPages: 1 });
      } catch (error) {
        pageLimit =
          error instanceof ExtractionFailure &&
          error.safeMessage.includes("maximum supported page count") &&
          error.pageCount === 2;
      }
      const truncated = await pdfExtractor.extract(bytes, {
        ...defaultOptions,
        maxCharacters: 18,
      });
      return pageLimit && truncated.truncated && truncated.characterCount <= 18;
    },
  },
]);

harness.section("DOCX extraction", [
  {
    description: "extracts headings, paragraphs, and basic table content in reading order",
    test: async () => {
      const bytes = createDocx(
        `${heading("Problem Report")}${text("Login Issue")}${text("Users cannot log in.")}${table}`,
      );
      const result = await docxExtractor.extract(bytes, defaultOptions);
      const readableText = result.text.toLowerCase();
      const reportAt = readableText.indexOf("problem report");
      const paragraphAt = readableText.indexOf("users cannot log in.");
      const browserAt = readableText.indexOf("browser");
      const chromeAt = readableText.indexOf("chrome");
      return (
        reportAt >= 0 &&
        paragraphAt > reportAt &&
        browserAt > paragraphAt &&
        chromeAt > browserAt &&
        result.characterCount === result.text.length &&
        result.text.includes("154")
      );
    },
  },
  {
    description: "normalizes an empty DOCX without inventing content",
    test: async () => {
      const result = await docxExtractor.extract(createDocx(""), defaultOptions);
      return result.text === "" && result.characterCount === 0 && !result.truncated;
    },
  },
]);

harness.section("Model and limits", [
  {
    description: "AttachmentContent declares a unique attachmentId one-to-one index",
    test: () => {
      const index = AttachmentContent.schema
        .indexes()
        .find(([fields]) => Object.keys(fields).join("+") === "attachmentId");
      return (
        index?.[1].unique === true &&
        AttachmentContent.schema.indexes().length === 1 &&
        AttachmentContent.schema.path("text") !== undefined &&
        IssueAttachment.schema.path("text") === undefined
      );
    },
  },
  {
    description: "AttachmentContent requires its references, text, counts, and extractor version",
    test: async () => {
      const content = new AttachmentContent({
        attachmentId: id(),
        issueId: id(),
        workspaceId: id(),
        text: "plain extracted text",
        characterCount: 20,
        truncated: false,
        extractorVersion: "v1",
      });
      await content.validate();
      const missing = new AttachmentContent({} as never);
      try {
        await missing.validate();
        return false;
      } catch {
        return content.truncated === false;
      }
    },
  },
  {
    description: "IssueAttachment uses a separate extraction status and defaults to not_started",
    test: async () => {
      const attachment = new IssueAttachment({
        workspaceId: id(),
        issueId: id(),
        uploadedBy: id(),
        originalName: "notes.txt",
        storageKey: "workspace/issue/object",
        mimeType: "text/plain",
        size: 4,
        category: "text",
      });
      await attachment.validate();
      return (
        attachment.extractionStatus === "not_started" && attachment.processingStatus === "uploaded"
      );
    },
  },
]);

let passed = 0;
let failed = 0;
const staticResults = await harness.runCollecting();
passed += staticResults.passed;
failed += staticResults.failed;

if (!isDatabaseConfigured()) {
  console.log("\nLive extraction service checks");
  console.log(
    "  · skipped: set MONGODB_URI in .env.local to run authorization and persistence checks",
  );
} else {
  console.log("\nLive extraction service checks");
  await connectToDatabase();
  const stamp = `${Date.now().toString(36)}-${id().toString()}`;
  const localRoot = path.resolve(process.cwd(), ".storage", `extraction-verify-${stamp}`);
  const storage = new LocalStorageProvider(localRoot);
  setStorageProviderForTests(storage);

  const owner = await User.create({
    name: "Extraction Owner",
    email: `extract-owner-${stamp}@sp.test`,
  });
  const member = await User.create({
    name: "Extraction Member",
    email: `extract-member-${stamp}@sp.test`,
  });
  const workspace = await Workspace.create({
    name: "Extraction Workspace",
    slug: `extract-${stamp}`,
    ownerId: owner._id,
    members: [
      { userId: owner._id, role: "owner" },
      { userId: member._id, role: "member" },
    ],
  });
  const issue = await Issue.create({
    workspaceId: workspace._id,
    projectId: null,
    createdBy: owner._id,
    assignedTo: null,
    title: "Extraction test Problem",
    description: "A sufficiently detailed description for extraction tests.",
    category: "other",
    status: "new",
    priority: "medium",
    source: "text",
    aiConfidence: null,
    estimatedMinutes: null,
    resolvedAt: null,
  });
  const key = `${workspace._id}/${issue._id}/${id()}`;
  const sourceText = "Support case\nThe checkout page returns HTTP 500.";
  await storage.upload(Buffer.from(sourceText), key);
  const attachment = await IssueAttachment.create({
    workspaceId: workspace._id,
    issueId: issue._id,
    uploadedBy: owner._id,
    originalName: "case.txt",
    storageKey: key,
    mimeType: "text/plain",
    size: Buffer.byteLength(sourceText),
    category: "text",
    processingStatus: "uploaded",
  });

  const imageKey = `${workspace._id}/${issue._id}/${id()}`;
  await storage.upload(Buffer.from([0x89, 0x50, 0x4e, 0x47]), imageKey);
  const imageAttachment = await IssueAttachment.create({
    workspaceId: workspace._id,
    issueId: issue._id,
    uploadedBy: owner._id,
    originalName: "screen.png",
    storageKey: imageKey,
    mimeType: "image/png",
    size: 4,
    category: "image",
  });

  const scannedKey = `${workspace._id}/${issue._id}/${id()}`;
  const scannedPdf = await createPdf([null]);
  await storage.upload(scannedPdf, scannedKey);
  const scannedAttachment = await IssueAttachment.create({
    workspaceId: workspace._id,
    issueId: issue._id,
    uploadedBy: owner._id,
    originalName: "scanned.pdf",
    storageKey: scannedKey,
    mimeType: "application/pdf",
    detectedMimeType: "application/pdf",
    size: scannedPdf.byteLength,
    category: "document",
  });

  const missingAttachment = await IssueAttachment.create({
    workspaceId: workspace._id,
    issueId: issue._id,
    uploadedBy: owner._id,
    originalName: "missing.txt",
    storageKey: `${workspace._id}/${issue._id}/${id()}`,
    mimeType: "text/plain",
    size: 5,
    category: "text",
  });

  const liveHarness = new VerifyHarness();
  liveHarness.section("Extraction persistence and authorization", [
    {
      description: "extracts and replaces one content record while advancing processing status",
      test: async () => {
        const first = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(attachment._id),
        );
        const second = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(attachment._id),
        );
        const records = await AttachmentContent.countDocuments({ attachmentId: attachment._id });
        const saved = await AttachmentContent.findOne({ attachmentId: attachment._id }).lean();
        const updatedAttachment = await IssueAttachment.findById(attachment._id).lean();
        return (
          first.status === "completed" &&
          second.status === "completed" &&
          records === 1 &&
          saved?.text === sourceText &&
          saved?.extractorVersion === "v1" &&
          updatedAttachment?.processingStatus === "processed" &&
          updatedAttachment.extractionStatus === "completed"
        );
      },
    },
    {
      description: "image attachments are marked unsupported without OCR or processing completion",
      test: async () => {
        const result = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(imageAttachment._id),
        );
        const updated = await IssueAttachment.findById(imageAttachment._id).lean();
        return (
          result.status === "unsupported" &&
          result.error?.includes("OCR") === true &&
          updated?.processingStatus === "uploaded"
        );
      },
    },
    {
      description:
        "scanned PDFs fail safely and a retry replaces content after text becomes available",
      test: async () => {
        const failedResult = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(scannedAttachment._id),
        );
        const failedRecord = await IssueAttachment.findById(scannedAttachment._id).lean();
        const searchablePdf = await createPdf(["Text is now available", "Second printable page"]);
        await storage.delete(scannedKey);
        await storage.upload(searchablePdf, scannedKey);
        const retried = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(scannedAttachment._id),
        );
        const contentCount = await AttachmentContent.countDocuments({
          attachmentId: scannedAttachment._id,
        });
        const content = await AttachmentContent.findOne({
          attachmentId: scannedAttachment._id,
        }).lean();
        return (
          failedResult.status === "failed" &&
          failedResult.error?.includes("No extractable text") === true &&
          failedRecord?.processingStatus === "failed" &&
          retried.status === "completed" &&
          contentCount === 1 &&
          content?.text.includes("Text is now available") === true
        );
      },
    },
    {
      description: "missing storage produces a safe failed extraction state",
      test: async () => {
        const result = await extractIssueAttachmentContent(
          String(owner._id),
          String(workspace._id),
          String(issue._id),
          String(missingAttachment._id),
        );
        return (
          result.status === "failed" && result.error === "The stored attachment is unavailable."
        );
      },
    },
    {
      description: "workspace members can view text while non-managers cannot start extraction",
      test: async () => {
        const content = await getIssueAttachmentExtractedContent(
          String(member._id),
          String(workspace._id),
          String(issue._id),
          String(attachment._id),
        );
        const retryDenied = await throwsStatus(() =>
          extractIssueAttachmentContent(
            String(member._id),
            String(workspace._id),
            String(issue._id),
            String(attachment._id),
          ),
        );
        return content.text === sourceText && retryDenied === 403;
      },
    },
  ]);
  const liveResults = await liveHarness.runCollecting();
  passed += liveResults.passed;
  failed += liveResults.failed;

  await AttachmentContent.deleteMany({ workspaceId: workspace._id });
  await IssueAttachment.deleteMany({ workspaceId: workspace._id });
  await Issue.deleteMany({ workspaceId: workspace._id });
  await Workspace.deleteOne({ _id: workspace._id });
  await User.deleteMany({ _id: { $in: [owner._id, member._id] } });
  await rm(localRoot, { recursive: true, force: true });
  setStorageProviderForTests(null);
  await disconnectFromDatabase();
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed}/${passed + failed} checks passed`);
process.exit(failed === 0 ? 0 : 1);
