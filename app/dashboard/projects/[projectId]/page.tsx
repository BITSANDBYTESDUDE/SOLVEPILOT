import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetailView } from "@/components/project/project-detail-view";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getProjectById } from "@/services/project.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Project Details",
  description: "View project details and resolution workflows.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: RouteProps) {
  const { user } = await requireUser("/dashboard/projects");
  const { projectId } = await params;

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    notFound();
  }

  let project;
  try {
    project = await getProjectById(user.id, activeWorkspace.id, projectId);
  } catch {
    notFound();
  }

  return (
    <ProjectDetailView
      workspaceId={activeWorkspace.id}
      project={project}
      currentUserRole={activeWorkspace.role}
    />
  );
}
