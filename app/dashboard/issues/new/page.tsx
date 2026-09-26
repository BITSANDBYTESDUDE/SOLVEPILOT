import type { Metadata } from "next";

import { NoWorkspaceState } from "@/components/dashboard/no-workspace-card";
import { IssueForm } from "@/components/issues/issue-form";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getWorkspaceProjects } from "@/services/project.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Create a Problem",
  description: "Describe a problem and let SolvePilot guide you toward a solution.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface NewIssuePageProps {
  searchParams: Promise<{ projectId?: string }>;
}

/**
 * Create a Problem (Task 11).
 *
 * The project selector is populated server-side from the active workspace only,
 * so the browser never gets to choose which workspace's projects are offered.
 */
export default async function NewIssuePage({ searchParams }: NewIssuePageProps) {
  const { user } = await requireUser("/dashboard/issues/new");
  const { projectId: requestedProjectId } = await searchParams;

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    return (
      <NoWorkspaceState
        title="Create a Problem"
        subtitle="Problems live inside a workspace, so pick one before creating a problem."
      />
    );
  }

  const projects = await getWorkspaceProjects(user.id, activeWorkspace.id);

  return (
    <IssueForm
      workspaceId={activeWorkspace.id}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
      }))}
      defaultProjectId={requestedProjectId ?? null}
    />
  );
}
