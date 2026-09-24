import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getWorkspace, updateWorkspace } from "@/services/workspace.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[id]` — one workspace, only for its members.
 *
 * `PATCH /api/workspaces/[id]` — rename or change the slug; requires `admin`.
 *
 * A caller who is not a member receives a 404 rather than a 403, so the
 * endpoint cannot be used to discover which workspace ids exist.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id } = await context.params;
    return jsonOk({ workspace: await getWorkspace(user.id, id) });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]" });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    return jsonOk({ workspace: await updateWorkspace(user.id, id, body) });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/workspaces/[id]" });
  }
}
