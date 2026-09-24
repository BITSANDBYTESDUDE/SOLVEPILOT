import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { setActiveWorkspaceCookie } from "@/lib/auth/active-workspace";
import { ValidationError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getWorkspace } from "@/services/workspace.service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/workspaces/active` — choose which workspace the dashboard shows.
 *
 * Membership is verified before the cookie is written, so the selection cannot
 * be pointed at a workspace the caller does not belong to.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireApiUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const workspaceId = (body as { workspaceId?: unknown })?.workspaceId;
    if (typeof workspaceId !== "string" || workspaceId.length === 0) {
      throw new ValidationError("A workspaceId is required.");
    }

    const workspace = await getWorkspace(user.id, workspaceId);
    return setActiveWorkspaceCookie(jsonOk({ activeWorkspaceId: workspace.id }), workspace.id);
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces/active" });
  }
}
