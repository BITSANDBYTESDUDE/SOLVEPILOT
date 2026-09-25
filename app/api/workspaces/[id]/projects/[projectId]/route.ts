import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { deleteProject, getProjectById, updateProject } from "@/services/project.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; projectId: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/projects/[projectId]`
 *
 * Retrieves project details if it belongs to the workspace and the caller is a member.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, projectId } = await context.params;

    const project = await getProjectById(user.id, workspaceId, projectId);
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/projects/[projectId]" });
  }
}

/**
 * `PATCH /api/workspaces/[workspaceId]/projects/[projectId]`
 *
 * Updates project fields (name, description, color, status).
 * Requires Owner or Admin permission.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, projectId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const project = await updateProject(user.id, workspaceId, projectId, body);
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/workspaces/[id]/projects/[projectId]" });
  }
}

/**
 * `DELETE /api/workspaces/[workspaceId]/projects/[projectId]`
 *
 * Permanently deletes a project from the workspace.
 * Requires Owner or Admin permission.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, projectId } = await context.params;

    await deleteProject(user.id, workspaceId, projectId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error, { route: "DELETE /api/workspaces/[id]/projects/[projectId]" });
  }
}
