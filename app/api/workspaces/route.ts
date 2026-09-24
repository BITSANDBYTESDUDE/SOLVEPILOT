import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http/api-response";
import { createWorkspace, listWorkspacesForUser } from "@/services/workspace.service";

export const dynamic = "force-dynamic";

/**
 * `GET /api/workspaces` — the workspaces the caller belongs to.
 *
 * `POST /api/workspaces` — create one; the caller becomes its `owner`.
 *
 * There is no "list all workspaces" endpoint on purpose: tenancy means the only
 * list a caller can obtain is the one they are a member of.
 */
export async function GET() {
  try {
    const { user } = await requireApiUser();
    return jsonOk({ workspaces: await listWorkspacesForUser(user.id) });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireApiUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const workspace = await createWorkspace(user.id, body);
    return jsonCreated({ workspace });
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces" });
  }
}
