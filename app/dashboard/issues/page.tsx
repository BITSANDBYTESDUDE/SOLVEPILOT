import type { Metadata } from "next";

import { NoWorkspaceState } from "@/components/dashboard/no-workspace-card";
import { IssueList } from "@/components/issues/issue-list";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { issueListViewFromQuery, EMPTY_ISSUE_LIST_STATE } from "@/lib/constants/issues";
import { isAppError } from "@/lib/errors";
import { getWorkspaceIssues, type IssueListResult } from "@/services/issue.service";
import { getWorkspaceProjects } from "@/services/project.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Problems",
  description: "Search, filter and review every problem your workspace is working through.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Problem management list (Task 12).
 *
 * The workspace is resolved from membership plus the active-workspace cookie —
 * never from a query parameter — so search terms, filters and pages can only ever
 * narrow down problems the caller is already allowed to see.
 *
 * The first page is rendered server-side from the URL, so a shared or refreshed
 * link lands on exactly the view it describes.
 */
export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  const { user } = await requireUser("/dashboard/issues");
  const params = await searchParams;

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

  const projectsPromise = getWorkspaceProjects(user.id, activeWorkspace.id);

  let result: IssueListResult;
  let usedFallback = false;

  try {
    result = await getWorkspaceIssues(user.id, activeWorkspace.id, params);
  } catch (error) {
    // A shared link can carry a project id that no longer exists or that belongs
    // to another workspace. Refuse it — as the service does — and show the
    // unfiltered list instead of an error page.
    const isBadFilter = isAppError(error) && error.statusCode < 500;
    if (!isBadFilter) throw error;

    usedFallback = true;
    result = await getWorkspaceIssues(user.id, activeWorkspace.id, {});
  }

  const projects = await projectsPromise;
  const view = usedFallback ? EMPTY_ISSUE_LIST_STATE : issueListViewFromQuery(result.query);

  return (
    <IssueList
      workspaceId={activeWorkspace.id}
      workspaceName={activeWorkspace.name}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
      }))}
      initialData={{ issues: result.issues, pagination: result.pagination }}
      initialView={view}
    />
  );
}
