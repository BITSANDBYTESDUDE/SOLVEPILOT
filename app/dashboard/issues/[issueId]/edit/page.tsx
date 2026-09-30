import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IssueEditForm } from "@/components/issues/issue-edit-form";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { canEditIssue } from "@/services/permission.service";
import { getIssueById } from "@/services/issue.service";
import { getWorkspaceProjects } from "@/services/project.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Edit Problem",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function EditIssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { user } = await requireUser("/dashboard/issues");
  const { issueId } = await params;
  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? workspaces[0];
  if (!workspace) notFound();
  let issue;
  try {
    issue = await getIssueById(user.id, workspace.id, issueId);
  } catch {
    notFound();
  }
  if (!canEditIssue(workspace.role, issue.createdBy, user.id)) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">
          You don&apos;t have permission to edit this problem.
        </h1>
        <p className="text-sm text-muted-foreground">
          Members can edit Problems they created. Ask a workspace owner or admin for help.
        </p>
        <div>
          <Link
            className="text-sm font-medium underline underline-offset-4"
            href={`/dashboard/issues/${issue.id}`}
          >
            Back to Problem
          </Link>
        </div>
      </div>
    );
  }
  const projects = await getWorkspaceProjects(user.id, workspace.id);
  return (
    <IssueEditForm
      workspaceId={workspace.id}
      issueId={issue.id}
      initialValues={{
        title: issue.title,
        description: issue.description,
        projectId: issue.projectId,
        category: issue.category,
        priority: issue.priority,
      }}
      projects={projects.map(({ id, name }) => ({ id, name }))}
    />
  );
}
