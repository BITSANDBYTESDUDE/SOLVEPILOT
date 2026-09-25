import "server-only";

import { Types } from "mongoose";

import { requireWorkspaceMember } from "@/lib/auth/workspace";
import { connectToDatabase } from "@/lib/db/connect";
import { logger } from "@/lib/logger";
import { Project, type ProjectDocument } from "@/models";
import { getRecentWorkspaceActivities, type ActivityItem } from "@/services/activity.service";
import type { ProjectStatus, WorkspaceRole } from "@/types/domain";

const log = logger.child("dashboard:service");

export interface DashboardProject {
  id: string;
  name: string;
  status: ProjectStatus;
  color: string;
  createdAt: Date;
}

export interface DashboardOverview {
  workspace: {
    id: string;
    name: string;
    slug: string;
    userRole: WorkspaceRole;
    memberCount: number;
    projectCount: number;
  };
  projects: {
    total: number;
    active: number;
    archived: number;
  };
  members: {
    total: number;
  };
  recentProjects: DashboardProject[];
  recentActivities: ActivityItem[];
  upcomingModules: {
    problems: string;
    aiAnalysis: string;
    tasks: string;
    verification: string;
    reports: string;
  };
}

/**
 * Dashboard statistics & overview service (Task 09).
 *
 * Computes authoritative workspace metrics directly from database collections.
 * Does not emit mock or fake statistics.
 */
export async function getDashboardOverview(
  userId: string,
  workspaceId: string,
): Promise<DashboardOverview> {
  const { workspace, membership } = await requireWorkspaceMember(userId, workspaceId);

  await connectToDatabase();

  const workspaceObjectId = new Types.ObjectId(workspaceId);

  // Run efficient counting, recent projects, and recent activities in parallel
  const [totalProjects, activeProjects, archivedProjects, recentDocs, recentActivities] =
    await Promise.all([
      Project.countDocuments({ workspaceId: workspaceObjectId }),
      Project.countDocuments({ workspaceId: workspaceObjectId, status: "active" }),
      Project.countDocuments({ workspaceId: workspaceObjectId, status: "archived" }),
      Project.find({ workspaceId: workspaceObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id name status color createdAt")
        .lean<
          Array<
            Pick<ProjectDocument, "name" | "status" | "color" | "createdAt"> & {
              _id: Types.ObjectId;
            }
          >
        >(),
      getRecentWorkspaceActivities(userId, workspaceId, 5),
    ]);

  const memberCount = Array.isArray(workspace.members) ? workspace.members.length : 1;

  const recentProjects: DashboardProject[] = recentDocs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    color: doc.color,
    createdAt: doc.createdAt,
  }));

  log.info("dashboard overview computed", {
    workspaceId,
    userId,
    totalProjects,
    memberCount,
  });

  return {
    workspace: {
      id: String(workspace._id),
      name: workspace.name,
      slug: workspace.slug,
      userRole: membership.role,
      memberCount,
      projectCount: totalProjects,
    },
    projects: {
      total: totalProjects,
      active: activeProjects,
      archived: archivedProjects,
    },
    members: {
      total: memberCount,
    },
    recentProjects,
    recentActivities,
    upcomingModules: {
      problems: "Issue tracking coming in Task 11",
      aiAnalysis: "AI diagnosis & planning coming in Task 16",
      tasks: "Task board coming in Task 23",
      verification: "Verification engine coming in Task 30",
      reports: "Report generation coming in Task 33",
    },
  };
}
