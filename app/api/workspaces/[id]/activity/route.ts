import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getWorkspaceActivities } from "@/services/activity.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/activity`
 *
 * Paginated activity feed for the specified workspace.
 * Requires authenticated workspace membership.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? undefined;
    const limit = searchParams.get("limit") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;

    const data = await getWorkspaceActivities(user.id, workspaceId, {
      page,
      limit,
      action,
      projectId,
    });

    return jsonOk(data);
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/activity" });
  }
}
