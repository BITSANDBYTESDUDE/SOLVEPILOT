import { type NextRequest, NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import {
  deleteIssueAttachment,
  getIssueAttachmentDownload,
  getIssueAttachmentMetadata,
} from "@/services/issue-attachment.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string; attachmentId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId, attachmentId } = await context.params;
    if (request.nextUrl.searchParams.get("metadata") === "1") {
      const attachment = await getIssueAttachmentMetadata(
        user.id,
        workspaceId,
        issueId,
        attachmentId,
      );
      return jsonOk({ attachment });
    }
    const attachment = await getIssueAttachmentDownload(
      user.id,
      workspaceId,
      issueId,
      attachmentId,
    );
    const inline =
      request.nextUrl.searchParams.get("inline") === "1" && attachment.category === "image";
    const asciiName = attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
    const disposition = inline ? "inline" : "attachment";
    const headers = new Headers({
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    return new NextResponse(Uint8Array.from(attachment.content), { status: 200, headers });
  } catch (error) {
    return jsonError(error, {
      route: "GET /api/workspaces/[id]/issues/[issueId]/attachments/[attachmentId]",
    });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId, attachmentId } = await context.params;
    await deleteIssueAttachment(user.id, workspaceId, issueId, attachmentId);
    return jsonOk({ removed: true });
  } catch (error) {
    return jsonError(error, {
      route: "DELETE /api/workspaces/[id]/issues/[issueId]/attachments/[attachmentId]",
    });
  }
}
