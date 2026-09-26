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
 * Searchable, filterable, sortable and paginated list of the workspace's
 * problems. Every workspace member may read them.
 *
 * Query parameters (all optional):
 *   `search`    — case-insensitive match on title or description (≤100 chars)
 *   `status`    — new | analyzing | planned | in_progress | verification |
 *                 resolved | closed
 *   `priority`  — low | medium | high | critical
 *   `category`  — technical | ui | business | productivity | academic | other
 *   `projectId` — an ObjectId from this workspace, or `none` for no project
 *   `sort`      — created_desc (default) | created_asc | updated_desc |
 *                 priority_desc | priority_asc | title_asc | title_desc
 *   `page`      — 1-based, default 1
 *   `limit`     — default 20, maximum 100
 *
 * Filtering, sorting and paging are executed by MongoDB; the endpoint only ever
 * returns one page.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const { issues, pagination } = await getWorkspaceIssues(user.id, workspaceId, query);

    return jsonOk({ issues, pagination });
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
