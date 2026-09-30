import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { retryIssueAttachment } from "@/services/issue-attachment.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string; attachmentId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId, attachmentId } = await context.params;
    const attachment = await retryIssueAttachment(user.id, workspaceId, issueId, attachmentId);
    return jsonOk({ attachment });
  } catch (error) {
    return jsonError(error, {
      route: "POST /api/workspaces/[id]/issues/[issueId]/attachments/[attachmentId]/retry",
    });
  }
}
