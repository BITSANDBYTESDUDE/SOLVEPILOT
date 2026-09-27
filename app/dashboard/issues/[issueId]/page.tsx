import type { Metadata } from "next";
import Link from "next/link";

import { NoWorkspaceState } from "@/components/dashboard/no-workspace-card";
import { IssueUnavailableNotice } from "@/components/issues/issue-badges";
import { IssueDetailView } from "@/components/issues/issue-detail-view";
import { Button } from "@/components/ui/button";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getIssueById, type IssueDetail } from "@/services/issue.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Problem",
  description: "Problem details and resolution workflow.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface IssueDetailPageProps {
  params: Promise<{ issueId: string }>;
}

/**
 * Problem detail (Task 11).
 *
 * The problem is always looked up inside the caller's active workspace, so an id
 * from another workspace is indistinguishable from one that does not exist.
 * A failed lookup renders a neutral retry state instead of leaking a 404/403
 * distinction or a server stack trace.
 */
export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { user } = await requireUser("/dashboard/issues");
  const { issueId } = await params;

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    return (
      <NoWorkspaceState
        title="Problem"
        subtitle="Problems live inside a workspace, so pick one before opening a problem."
      />
    );
  }

  let issue: IssueDetail | null = null;
  try {
    issue = await getIssueById(user.id, activeWorkspace.id, issueId);
  } catch {
    issue = null;
  }

  if (!issue) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Problems are always opened inside the workspace they belong to.
          </p>
        </div>

        <IssueUnavailableNotice />

        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/dashboard/issues">Back to Problems</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <IssueDetailView issue={issue} />;
}
