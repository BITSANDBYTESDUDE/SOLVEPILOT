import "server-only";

import { Types } from "mongoose";

import { requireWorkspaceMember } from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { escapeRegex } from "@/lib/utils/search";
import { Project, User, type ProjectDocument } from "@/models";
import { canCreateProject, canDeleteProject, canEditProject } from "@/services/permission.service";
import { createActivity } from "@/services/activity.service";
import type { ProjectStatus } from "@/types/domain";
import {
  createProjectSchema,
  DEFAULT_PROJECT_COLOR,
  projectFilterSchema,
  updateProjectSchema,
} from "@/validators/project";

const log = logger.child("project:service");

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  createdBy: string;
  creatorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDetail extends ProjectSummary {
  creatorEmail?: string;
}

/**
 * Project management service (Task 08).
 *
 * Implements project lifecycle operations scoped to each workspace.
 * Every operation enforces workspace membership and role authorization,
 * verifying that a project belongs strictly to the requested workspace.
 */

/**
 * Create a new project inside the workspace.
 * Requires Owner or Admin permission.
 */
export async function createProject(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<ProjectSummary> {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canCreateProject(membership.role)) {
    throw new ForbiddenError("You do not have permission to create projects in this workspace.");
  }

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid project data.");
  }

  const { name, description = "", color = DEFAULT_PROJECT_COLOR } = parsed.data;

  await connectToDatabase();

  const created = (await Project.create({
    workspaceId: new Types.ObjectId(workspaceId),
    name,
    description,
    status: "active",
    color,
    createdBy: new Types.ObjectId(userId),
  })) as unknown as ProjectDocument & { _id: Types.ObjectId };

  // Log activity
  void createActivity({
    workspaceId,
    actorId: userId,
    action: "project.created",
    metadata: {
      projectId: String(created._id),
      projectName: created.name,
      color: created.color,
    },
  });

  log.info("project created", {
    workspaceId,
    projectId: String(created._id),
    userId,
  });

  return {
    id: String(created._id),
    workspaceId,
    name: created.name,
    description: created.description,
    status: created.status,
    color: created.color,
    createdBy: String(created.createdBy),
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * List projects belonging to the workspace with optional filtering and sorting.
 * All workspace members (Owner, Admin, Member) can view projects.
 */
export async function getWorkspaceProjects(
  userId: string,
  workspaceId: string,
  filterInput?: unknown,
): Promise<ProjectSummary[]> {
  await requireWorkspaceMember(userId, workspaceId);

  const parsed = projectFilterSchema.safeParse(filterInput ?? {});
  const {
    search,
    status,
    sort = "recent",
  } = parsed.success ? parsed.data : { status: "all", sort: "recent" };

  await connectToDatabase();

  const query: Record<string, unknown> = {
    workspaceId: new Types.ObjectId(workspaceId),
  };

  if (status && status !== "all") {
    query.status = status;
  }

  if (search && search.trim().length > 0) {
    const escaped = escapeRegex(search.trim());
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === "oldest") sortOption = { createdAt: 1 };
  else if (sort === "name-asc") sortOption = { name: 1 };
  else if (sort === "name-desc") sortOption = { name: -1 };
  else if (sort === "updated") sortOption = { updatedAt: -1 };

  const projects = await Project.find(query)
    .sort(sortOption)
    .lean<Array<ProjectDocument & { _id: Types.ObjectId }>>();

  // Look up creator names to enrich summaries
  const creatorIds = [...new Set(projects.map((p) => String(p.createdBy)))];
  const creators = await User.find({ _id: { $in: creatorIds } })
    .select("_id name")
    .lean<Array<{ _id: Types.ObjectId; name: string }>>();

  const creatorMap = new Map(creators.map((c) => [String(c._id), c.name]));

  return projects.map((p) => ({
    id: String(p._id),
    workspaceId: String(p.workspaceId),
    name: p.name,
    description: p.description,
    status: p.status,
    color: p.color,
    createdBy: String(p.createdBy),
    creatorName: creatorMap.get(String(p.createdBy)),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Retrieve a single project by ID.
 * Verifies that the project exists, belongs to the specified workspace,
 * and that the caller is a member.
 */
export async function getProjectById(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<ProjectDetail> {
  await requireWorkspaceMember(userId, workspaceId);

  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  await connectToDatabase();

  const project = await Project.findOne({
    _id: new Types.ObjectId(projectId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean<(ProjectDocument & { _id: Types.ObjectId }) | null>();

  if (!project) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  const creator = await User.findById(project.createdBy)
    .select("name email")
    .lean<{ name: string; email: string } | null>();

  return {
    id: String(project._id),
    workspaceId: String(project.workspaceId),
    name: project.name,
    description: project.description,
    status: project.status,
    color: project.color,
    createdBy: String(project.createdBy),
    creatorName: creator?.name,
    creatorEmail: creator?.email,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Update project details (name, description, color, status).
 * Requires Owner or Admin permission.
 */
export async function updateProject(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
): Promise<ProjectSummary> {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canEditProject(membership.role)) {
    throw new ForbiddenError("You do not have permission to edit projects in this workspace.");
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid project update data.");
  }

  await connectToDatabase();

  const existing = await Project.findOne({
    _id: new Types.ObjectId(projectId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean<(ProjectDocument & { _id: Types.ObjectId }) | null>();

  if (!existing) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  const updateFields: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateFields.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateFields.description = parsed.data.description;
  if (parsed.data.color !== undefined) updateFields.color = parsed.data.color;
  if (parsed.data.status !== undefined) updateFields.status = parsed.data.status;

  const updated = await Project.findByIdAndUpdate(
    projectId,
    { $set: updateFields },
    { new: true },
  ).lean<(ProjectDocument & { _id: Types.ObjectId }) | null>();

  if (!updated) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  // Activity log: determine whether this was an archive action or regular update
  const isArchived = parsed.data.status === "archived" && existing.status !== "archived";
  const action = isArchived ? "project.archived" : "project.updated";

  void createActivity({
    workspaceId,
    actorId: userId,
    action,
    metadata: {
      projectId,
      projectName: updated.name,
      previousName: existing.name !== updated.name ? existing.name : undefined,
      newName: existing.name !== updated.name ? updated.name : undefined,
      changedFields: Object.keys(updateFields),
    },
  });

  log.info("project updated", {
    workspaceId,
    projectId,
    userId,
    action,
  });

  return {
    id: String(updated._id),
    workspaceId: String(updated.workspaceId),
    name: updated.name,
    description: updated.description,
    status: updated.status,
    color: updated.color,
    createdBy: String(updated.createdBy),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Archive a project.
 * Helper method for marking status as "archived".
 */
export async function archiveProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<ProjectSummary> {
  return updateProject(userId, workspaceId, projectId, { status: "archived" });
}

/**
 * Permanently delete a project from the workspace.
 * Requires Owner or Admin permission.
 */
export async function deleteProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<{ success: true }> {
  const { membership } = await requireWorkspaceMember(userId, workspaceId);

  if (!canDeleteProject(membership.role)) {
    throw new ForbiddenError("You do not have permission to delete projects in this workspace.");
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  await connectToDatabase();

  const project = await Project.findOne({
    _id: new Types.ObjectId(projectId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean<(ProjectDocument & { _id: Types.ObjectId }) | null>();

  if (!project) {
    throw new NotFoundError("Project not found in this workspace.");
  }

  await Project.deleteOne({
    _id: new Types.ObjectId(projectId),
    workspaceId: new Types.ObjectId(workspaceId),
  });

  void createActivity({
    workspaceId,
    actorId: userId,
    action: "project.deleted",
    metadata: {
      projectId,
      projectName: project.name,
    },
  });

  log.info("project deleted", {
    workspaceId,
    projectId,
    userId,
  });

  return { success: true };
}
