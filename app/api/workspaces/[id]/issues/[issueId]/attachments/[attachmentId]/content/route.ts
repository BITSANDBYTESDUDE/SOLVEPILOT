import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getIssueAttachmentExtractedContent } from "@/services/attachment-extraction.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string; attachmentId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId, attachmentId } = await context.params;
    const content = await getIssueAttachmentExtractedContent(
      user.id,
      workspaceId,
      issueId,
      attachmentId,
    );
    return jsonOk({ content }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, {
      route: "GET /api/workspaces/[id]/issues/[issueId]/attachments/[attachmentId]/content",
    });
  }
}
