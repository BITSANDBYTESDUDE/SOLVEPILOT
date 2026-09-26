import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http/api-response";
import { createIssue, getWorkspaceIssues } from "@/services/issue.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/issues`
 *
 * Lists the problems belonging to the workspace, newest first. Every workspace
 * member may read them; search, filtering and pagination arrive with Task 12.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    const issues = await getWorkspaceIssues(user.id, workspaceId);
    return jsonOk({ issues });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/issues" });
  }
}

/**
 * `POST /api/workspaces/[workspaceId]/issues`
 *
 * Creates a problem in the workspace, optionally attached to one of that
 * workspace's projects.
 *
 * `workspaceId` comes from the URL and `createdBy` from the session; neither can
 * be overridden by the body. Any workspace member (owner, admin or member) may
 * create a problem.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const issue = await createIssue(user.id, workspaceId, body);
    return jsonCreated({ issue });
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces/[id]/issues" });
  }
}
