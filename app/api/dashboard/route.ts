import { type NextRequest } from "next/server";

import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getDashboardOverview } from "@/services/dashboard.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const dynamic = "force-dynamic";

/**
 * `GET /api/dashboard`
 *
 * Retrieves real-time statistics and overview metrics for the caller's active workspace.
 */
export async function GET(_request: NextRequest) {
  try {
    const { user } = await requireApiUser();

    const [workspaces, activeWorkspaceId] = await Promise.all([
      listWorkspacesForUser(user.id),
      getActiveWorkspaceId(),
    ]);

    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

    if (!activeWorkspace) {
      return jsonOk({ overview: null });
    }

    const overview = await getDashboardOverview(user.id, activeWorkspace.id);
    return jsonOk({ overview });
  } catch (error) {
    return jsonError(error, { route: "GET /api/dashboard" });
  }
}
