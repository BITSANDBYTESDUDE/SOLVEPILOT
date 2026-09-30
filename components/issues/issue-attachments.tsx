"use client";

import {
  Eye,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_REQUEST,
} from "@/lib/constants/attachments";
import type {
  AttachmentCategory,
  AttachmentProcessingStatus,
  ExtractionStatus,
} from "@/types/domain";

export interface IssueAttachmentItem {
  id: string;
  workspaceId: string;
  issueId: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: AttachmentCategory;
  detectedMimeType: string | null;
  processingStatus: AttachmentProcessingStatus;
  extractionStatus: ExtractionStatus;
  extractedCharacterCount: number | null;
  extractedPageCount: number | null;
  extractionError: string | null;
  extractedAt: Date | string | null;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
  createdAt: Date | string;
  updatedAt: Date | string;
}

type QueueEntry = { file: File; state: "ready" | "uploading" | "uploaded" | "failed" };
type AttachmentResponse = {
  success?: boolean;
  data?: { attachments?: IssueAttachmentItem[] };
  error?: { message?: string };
};

type ExtractedContent = {
  attachmentId: string;
  text: string;
  characterCount: number;
  pageCount: number | null;
  truncated: boolean;
  extractorVersion: string;
  updatedAt: Date | string;
};

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function processingStatusLabel(status: IssueAttachmentItem["processingStatus"]): string {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "queued":
      return "Queued";
    case "processing":
      return "Processing…";
    case "processed":
      return "Processed";
    case "failed":
      return "Processing failed";
  }
}

const EXTRACTABLE_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function supportsTextExtraction(attachment: IssueAttachmentItem): boolean {
  return (
    attachment.category !== "image" &&
    EXTRACTABLE_MIME_TYPES.has(attachment.detectedMimeType ?? attachment.mimeType)
  );
}

function extractionStatusLabel(attachment: IssueAttachmentItem): string {
  if (!supportsTextExtraction(attachment) || attachment.extractionStatus === "unsupported") {
    return "Text extraction unavailable";
  }
  switch (attachment.extractionStatus) {
    case "not_started":
      return "Ready for extraction";
    case "processing":
      return "Extracting content…";
    case "completed":
      return "Content extracted";
    case "failed":
      return "Extraction failed";
  }
}

function typeLabel(mimeType: string): string {
  if (mimeType === "image/jpeg") return "JPG";
  if (
    mimeType === "text/csv" ||
    mimeType.includes("spreadsheet") ||
    mimeType === "application/vnd.ms-excel"
  )
    return "Spreadsheet";
  if (mimeType === "text/plain") return "TXT";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml")) return "Document";
  return mimeType.split("/").at(-1)?.toUpperCase() ?? "File";
}

function FileTypeIcon({ attachment }: { attachment: IssueAttachmentItem }) {
  const Icon =
    attachment.category === "image"
      ? ImageIcon
      : attachment.category === "spreadsheet"
        ? FileSpreadsheet
        : FileText;
  return <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export function IssueAttachments({
  workspaceId,
  issueId,
  attachments: initialAttachments,
  maxFileSizeBytes,
  canManage,
}: {
  workspaceId: string;
  issueId: string;
  attachments: IssueAttachmentItem[];
  maxFileSizeBytes: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = React.useState(initialAttachments);
  const [queue, setQueue] = React.useState<QueueEntry[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [extractingId, setExtractingId] = React.useState<string | null>(null);
  const [extractedContent, setExtractedContent] = React.useState<ExtractedContent | null>(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const selectFiles = (files: File[]) => {
    setError("");
    setNotice("");
    if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
      setQueue(files.map((file) => ({ file, state: "failed" })));
      setError(`You can upload up to ${MAX_ATTACHMENTS_PER_REQUEST} files at a time.`);
      return;
    }
    const invalid = files.find((file) => {
      const mimeType = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
      return (
        !file.name.trim() ||
        file.size < 1 ||
        file.size > maxFileSizeBytes ||
        !(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)
      );
    });
    setQueue(files.map((file) => ({ file, state: invalid ? "failed" : "ready" })));
    if (invalid) {
      const mimeType = invalid.type.toLowerCase().split(";")[0]?.trim() ?? "";
      setError(
        invalid.size > maxFileSizeBytes
          ? `This file exceeds the ${Math.round(maxFileSizeBytes / 1024 / 1024)} MB limit.`
          : !(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)
            ? "This file type is not supported."
            : "Choose a valid, non-empty file.",
      );
    }
  };

  const upload = async () => {
    if (uploading || queue.length === 0 || queue.some((item) => item.state === "uploaded")) return;
    setUploading(true);
    setError("");
    setNotice("");
    setQueue((current) => current.map((item) => ({ ...item, state: "uploading" })));
    const form = new FormData();
    for (const item of queue) form.append("files", item.file, item.file.name);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issueId}/attachments`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as AttachmentResponse;
      if (!response.ok || !payload.data?.attachments) {
        setError(payload.error?.message ?? "Unable to upload this file.");
        setQueue((current) => current.map((item) => ({ ...item, state: "failed" })));
        return;
      }
      setAttachments((current) => [...payload.data!.attachments!, ...current]);
      setQueue((current) => current.map((item) => ({ ...item, state: "uploaded" })));
      setNotice(
        payload.data.attachments.length === 1 ? "Attachment uploaded." : "Attachments uploaded.",
      );
      router.refresh();
    } catch {
      setError("Unable to upload this file.");
      setQueue((current) => current.map((item) => ({ ...item, state: "failed" })));
    } finally {
      setUploading(false);
    }
  };

  const extractContent = async (attachment: IssueAttachmentItem) => {
    if (!canManage || extractingId) return;
    setError("");
    setNotice("");
    setExtractedContent(null);
    setExtractingId(attachment.id);
    setAttachments((current) =>
      current.map((item) =>
        item.id === attachment.id
          ? { ...item, extractionStatus: "processing", extractionError: null }
          : item,
      ),
    );
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}/extract`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        data?: {
          extraction?: {
            attachmentId: string;
            status: ExtractionStatus;
            characterCount: number;
            pageCount: number | null;
            truncated: boolean;
            extractorVersion: string | null;
            extractedAt: string | null;
            error: string | null;
          };
        };
        error?: { message?: string };
      };
      const result = payload.data?.extraction;
      if (!response.ok || !result) {
        setAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  extractionStatus: attachment.extractionStatus,
                  extractionError: attachment.extractionError,
                }
              : item,
          ),
        );
        setError(payload.error?.message ?? "Unable to extract content from this attachment.");
        return;
      }
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? {
                ...item,
                extractionStatus: result.status,
                extractedCharacterCount: result.characterCount,
                extractedPageCount: result.pageCount,
                extractionError: result.error,
                extractedAt: result.extractedAt,
              }
            : item,
        ),
      );
      if (result.status === "completed") {
        setNotice(
          result.truncated
            ? "Content extracted with the configured text limit."
            : "Content extracted successfully.",
        );
      } else if (result.status === "failed" || result.status === "unsupported") {
        setError(result.error ?? "Unable to extract text from this attachment.");
      }
      router.refresh();
    } catch {
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? {
                ...item,
                extractionStatus: attachment.extractionStatus,
                extractionError: attachment.extractionError,
              }
            : item,
        ),
      );
      setError("Unable to extract content from this attachment.");
    } finally {
      setExtractingId(null);
    }
  };

  const viewExtractedContent = async (attachment: IssueAttachmentItem) => {
    setError("");
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}/content`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { content?: ExtractedContent };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.content) {
        setError(payload.error?.message ?? "Unable to load extracted content.");
        return;
      }
      setExtractedContent(payload.data.content);
    } catch {
      setError("Unable to load extracted content.");
    }
  };

  const retry = async (attachment: IssueAttachmentItem) => {
    if (!canManage || retryingId) return;
    setError("");
    setNotice("");
    setRetryingId(attachment.id);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}/retry`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { attachment?: IssueAttachmentItem };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.attachment) {
        setError(payload.error?.message ?? "Unable to retry this attachment.");
        return;
      }
      setAttachments((current) =>
        current.map((item) => (item.id === attachment.id ? payload.data!.attachment! : item)),
      );
      setNotice("Attachment queued for processing.");
      router.refresh();
    } catch {
      setError("Unable to retry this attachment.");
    } finally {
      setRetryingId(null);
    }
  };

  const remove = async (attachment: IssueAttachmentItem) => {
    if (!canManage || uploading) return;
    if (
      !window.confirm(
        `Delete Attachment?\n\nAre you sure you want to remove “${attachment.originalName}”?`,
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Unable to remove this attachment.");
        return;
      }
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setNotice("Attachment removed.");
      router.refresh();
    } catch {
      setError("Unable to remove this attachment.");
    }
  };

  const accept = ALLOWED_ATTACHMENT_MIME_TYPES.join(",");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4" aria-hidden="true" />
          Attachments
        </CardTitle>
        <CardDescription>Files that help explain or reproduce this problem.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        {attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No attachments yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add screenshots, documents, or other files that can help explain this problem.
            </p>
            {canManage ? (
              <Button
                className="mt-4"
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip aria-hidden="true" />
                Add Attachments
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
              >
                {attachment.category === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}?inline=1`}
                    alt={`Preview of ${attachment.originalName}`}
                    className="size-14 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <FileTypeIcon attachment={attachment} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={attachment.originalName}>
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel(attachment.mimeType)} · {formatFileSize(attachment.size)} ·{" "}
                    {attachment.uploadedBy.name} ·{" "}
                    {new Date(attachment.createdAt).toLocaleDateString()}
                  </p>
                  <p
                    className={`mt-1 text-xs ${attachment.processingStatus === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                    role="status"
                  >
                    <span aria-hidden="true">● </span>
                    {processingStatusLabel(attachment.processingStatus)}
                  </p>
                  <p
                    className={`mt-1 text-xs ${attachment.extractionStatus === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                    role="status"
                  >
                    {extractionStatusLabel(attachment)}
                    {attachment.extractionStatus === "failed" && attachment.extractionError
                      ? ` — ${attachment.extractionError}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/api/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachment.id}`}
                      download={attachment.originalName}
                    >
                      Download
                    </a>
                  </Button>
                  {attachment.extractionStatus === "completed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewExtractedContent(attachment)}
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      View Extracted Content
                    </Button>
                  ) : null}
                  {canManage &&
                  supportsTextExtraction(attachment) &&
                  (attachment.extractionStatus === "not_started" ||
                    attachment.extractionStatus === "failed") ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={extractingId !== null}
                      onClick={() => extractContent(attachment)}
                    >
                      {extractingId === attachment.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <FileSearch className="size-3.5" aria-hidden="true" />
                      )}
                      {attachment.extractionStatus === "failed"
                        ? "Retry Extraction"
                        : "Extract Content"}
                    </Button>
                  ) : null}
                  {attachment.extractionStatus === "processing" ? (
                    <Button variant="outline" size="sm" disabled>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Extracting…
                    </Button>
                  ) : null}
                  {canManage &&
                  attachment.processingStatus === "failed" &&
                  attachment.extractionStatus !== "failed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryingId !== null}
                      onClick={() => retry(attachment)}
                    >
                      {retryingId === attachment.id ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      ) : null}
                      Retry
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${attachment.originalName}`}
                      onClick={() => remove(attachment)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <div className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                selectFiles(Array.from(event.target.files ?? []));
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 ${dragging ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFiles(Array.from(event.dataTransfer.files));
              }}
              disabled={uploading}
              aria-label="Choose or drop attachment files"
            >
              <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">
                Drag &amp; drop files here or browse files
              </span>
              <span className="text-xs text-muted-foreground">
                Maximum {Math.round(maxFileSizeBytes / 1024 / 1024)} MB per file · up to{" "}
                {MAX_ATTACHMENTS_PER_REQUEST} files
              </span>
            </button>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP, PDF, Word, Excel, CSV, and plain text.
            </p>

            {queue.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                {queue.map(({ file, state }) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {state === "uploading" ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          Uploading…
                        </span>
                      ) : state === "uploaded" ? (
                        "Uploaded"
                      ) : state === "failed" ? (
                        "Upload failed"
                      ) : (
                        formatFileSize(file.size)
                      )}
                    </span>
                  </div>
                ))}
                {queue.every((item) => item.state === "ready" || item.state === "failed") ? (
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => {
                        setQueue([]);
                        setError("");
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      disabled={uploading || queue.some((item) => item.state === "uploaded")}
                      onClick={upload}
                    >
                      {queue.some((item) => item.state === "failed") ? "Retry" : "Upload files"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {extractedContent ? (
          <section className="rounded-lg border p-4" aria-label="Extracted attachment content">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">Extracted Content</h3>
                <p className="text-xs text-muted-foreground">
                  {extractedContent.characterCount.toLocaleString()} characters
                  {extractedContent.pageCount !== null
                    ? ` · ${extractedContent.pageCount} pages`
                    : ""}
                  {extractedContent.truncated ? " · limited to the configured extraction size" : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close extracted content"
                onClick={() => setExtractedContent(null)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-sm break-words whitespace-pre-wrap">
              {extractedContent.text}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Extractor {extractedContent.extractorVersion}
            </p>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
