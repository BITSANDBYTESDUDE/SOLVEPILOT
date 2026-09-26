import type { Metadata } from "next";

import { NoWorkspaceState } from "@/components/dashboard/no-workspace-card";
import { IssueList } from "@/components/issues/issue-list";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getWorkspaceIssues } from "@/services/issue.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Problems",
  description: "Every problem your workspace is working through, newest first.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Problem list (Task 11).
 *
 * The workspace is resolved from membership plus the active-workspace cookie —
 * never from a query parameter — so the list can only ever show problems from a
 * workspace the caller belongs to.
 */
export default async function IssuesPage() {
  const { user } = await requireUser("/dashboard/issues");

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  // Matches the other dashboard pages: fall back to the first workspace the user
  // belongs to when no active workspace has been selected yet.
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    return (
      <NoWorkspaceState
        title="Problems"
        subtitle="Problems live inside a workspace, so pick one before creating or viewing them."
      />
    );
  }

  const issues = await getWorkspaceIssues(user.id, activeWorkspace.id);

  return <IssueList issues={issues} workspaceName={activeWorkspace.name} />;
}
