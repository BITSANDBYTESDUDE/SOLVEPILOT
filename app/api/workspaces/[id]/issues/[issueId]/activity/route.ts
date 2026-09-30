import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getIssueActivities } from "@/services/activity.service";
import { getIssueById } from "@/services/issue.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId } = await context.params;
    // Also proves the Issue belongs to this requested workspace before serving its history.
    await getIssueById(user.id, workspaceId, issueId);
    const activities = await getIssueActivities(user.id, workspaceId, issueId);
    return jsonOk({ activities });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/issues/[issueId]/activity" });
  }
}
