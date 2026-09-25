import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http/api-response";
import { createProject, getWorkspaceProjects } from "@/services/project.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/workspaces/[workspaceId]/projects`
 *
 * List all projects belonging to the workspace.
 * Supports query parameters: search, status, sort.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId } = await context.params;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const sort = searchParams.get("sort") ?? undefined;

    const projects = await getWorkspaceProjects(user.id, workspaceId, {
      search,
      status,
      sort,
    });

    return jsonOk({ projects });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/projects" });
  }
}

/**
 * `POST /api/workspaces/[workspaceId]/projects`
 *
 * Creates a new project in the workspace.
 * Requires Owner or Admin permission.
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

    const project = await createProject(user.id, workspaceId, body);
    return jsonCreated({ project });
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces/[id]/projects" });
  }
}
