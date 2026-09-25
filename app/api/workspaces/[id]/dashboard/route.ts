import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getDashboardOverview } from "@/services/dashboard.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/dashboard`
 *
 * Retrieves real-time statistics and overview metrics for the specified workspace.
 * Requires the authenticated caller to be a member of the workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    const overview = await getDashboardOverview(user.id, workspaceId);
    return jsonOk({ overview });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/dashboard" });
  }
}
