import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

import { ProjectList } from "@/components/project/project-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getWorkspaceProjects } from "@/services/project.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Projects",
  description: "Manage projects and problem workflows within your SolvePilot workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { user } = await requireUser("/dashboard/projects");

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Projects organize problems and resolution workflows.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Workspace Found</CardTitle>
            <CardDescription>
              You need to belong to a workspace before creating or viewing projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <Building2 className="size-12 text-muted-foreground/60" aria-hidden="true" />
            <p className="max-w-md text-sm text-muted-foreground">
              Create your first workspace or switch to an active workspace in settings.
            </p>
            <Button asChild>
              <Link href="/dashboard/settings#workspaces">Go to Workspace Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projects = await getWorkspaceProjects(user.id, activeWorkspace.id);

  return (
    <ProjectList
      workspaceId={activeWorkspace.id}
      workspaceName={activeWorkspace.name}
      currentUserRole={activeWorkspace.role}
      initialProjects={projects}
    />
  );
}
