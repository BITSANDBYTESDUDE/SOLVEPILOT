import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/services/workspace-member.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * `PATCH /api/workspaces/[workspaceId]/members/[userId]`
 *
 * Changes the role of a workspace member.
 * Only owner/admin can perform this; admins cannot modify owner or promote to owner.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id, userId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const member = await updateWorkspaceMemberRole(user.id, id, userId, body);
    return jsonOk({ member });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/workspaces/[id]/members/[userId]" });
  }
}

/**
 * `DELETE /api/workspaces/[workspaceId]/members/[userId]`
 *
 * Removes a member from the workspace.
 * Owner can remove members; Admin can remove normal members; Member cannot remove users.
 * Owner cannot be removed if that would leave workspace without an owner.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id, userId } = await context.params;

    await removeWorkspaceMember(user.id, id, userId);
    return jsonOk({ removed: true });
  } catch (error) {
    return jsonError(error, { route: "DELETE /api/workspaces/[id]/members/[userId]" });
  }
}
