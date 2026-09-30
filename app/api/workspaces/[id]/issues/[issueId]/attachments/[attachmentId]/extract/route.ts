import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { extractIssueAttachmentContent } from "@/services/attachment-extraction.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string; attachmentId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId, attachmentId } = await context.params;
    const extraction = await extractIssueAttachmentContent(
      user.id,
      workspaceId,
      issueId,
      attachmentId,
    );
    return jsonOk({ extraction }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, {
      route: "POST /api/workspaces/[id]/issues/[issueId]/attachments/[attachmentId]/extract",
    });
  }
}
