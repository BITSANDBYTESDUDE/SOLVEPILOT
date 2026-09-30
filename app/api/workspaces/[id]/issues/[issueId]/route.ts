import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getIssueById, updateIssue } from "@/services/issue.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId } = await context.params;
    const issue = await getIssueById(user.id, workspaceId, issueId);
    return jsonOk({ issue });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/issues/[issueId]" });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const issue = await updateIssue(user.id, workspaceId, issueId, body);
    return jsonOk({ issue });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/workspaces/[id]/issues/[issueId]" });
  }
}
