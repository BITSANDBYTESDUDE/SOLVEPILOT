import type { Metadata } from "next";
import Link from "next/link";

import { NoWorkspaceState } from "@/components/dashboard/no-workspace-card";
import { IssueDetailView } from "@/components/issues/issue-detail-view";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getIssueById, type IssueDetail } from "@/services/issue.service";
import { getIssueActivities } from "@/services/activity.service";
import {
  getMaxAttachmentSizeBytes,
  listIssueAttachments,
} from "@/services/issue-attachment.service";
import { canEditIssue } from "@/services/permission.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Problem",
  description: "Problem details and resolution workflow.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface IssueDetailPageProps {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

/**
 * Problem detail (Task 11).
 *
 * The problem is always looked up inside the caller's active workspace, so an id
 * from another workspace is indistinguishable from one that does not exist.
 * Missing and cross-workspace Problems render the same neutral not-found state;
 * unexpected load errors use a generic retry message without exposing internals.
 */
export default async function IssueDetailPage({ params, searchParams }: IssueDetailPageProps) {
  const { user } = await requireUser("/dashboard/issues");
  const [{ issueId }, query] = await Promise.all([params, searchParams]);

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
  let loadFailed = false;
  try {
    issue = await getIssueById(user.id, activeWorkspace.id, issueId);
  } catch (error) {
    loadFailed = !(error instanceof NotFoundError);
  }

  if (!issue) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {loadFailed ? "Unable to load this problem." : "Problem not found"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadFailed
              ? "Please try again."
              : "The problem may have been removed or you may not have access to it."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {loadFailed ? (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/issues/${issueId}`}>Try Again</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/dashboard/issues">Back to Problems</Link>
          </Button>
        </div>
      </div>
    );
  }

  const [activities, attachmentRecords] = await Promise.all([
    getIssueActivities(user.id, activeWorkspace.id, issueId),
    listIssueAttachments(user.id, activeWorkspace.id, issueId),
  ]);
  return (
    <IssueDetailView
      issue={issue}
      activities={activities}
      attachments={attachmentRecords.map((attachment) => ({
        ...attachment,
        createdAt: attachment.createdAt.toISOString(),
        updatedAt: attachment.updatedAt.toISOString(),
        extractedAt: attachment.extractedAt?.toISOString() ?? null,
      }))}
      maxAttachmentSizeBytes={getMaxAttachmentSizeBytes()}
      canEdit={canEditIssue(activeWorkspace.role, issue.createdBy, user.id)}
      saved={query.saved === "1"}
    />
  );
}
