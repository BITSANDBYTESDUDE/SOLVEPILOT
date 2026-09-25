import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http/api-response";
import { addWorkspaceMember, getWorkspaceMembers } from "@/services/workspace-member.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/members`
 *
 * Returns safe member information for the given workspace.
 * Requires caller to be an authenticated member of the workspace.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id } = await context.params;
    const members = await getWorkspaceMembers(user.id, id);
    return jsonOk({ members });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/members" });
  }
}

/**
 * `POST /api/workspaces/[workspaceId]/members`
 *
 * Adds a new member to the workspace.
 * Requires caller to have owner or admin permission. Admins cannot add an owner.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const member = await addWorkspaceMember(user.id, id, body);
    return jsonCreated({ member });
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces/[id]/members" });
  }
}
