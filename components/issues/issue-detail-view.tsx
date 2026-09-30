import { ArrowLeft, Calendar, FolderKanban, Pencil, Sparkles, User } from "lucide-react";
import Link from "next/link";

import { IssueCategoryBadge, IssuePriorityBadge } from "@/components/issues/issue-badges";
import { IssueStatusControl } from "@/components/issues/issue-status-control";
import { Button } from "@/components/ui/button";
import { IssueActivity } from "@/components/issues/issue-activity";
import { IssueAttachments, type IssueAttachmentItem } from "@/components/issues/issue-attachments";
import type { SafeActivityItem } from "@/services/activity.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { issueCategoryLabel, issuePriorityLabel, issueSourceLabel } from "@/lib/constants/issues";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { IssueDetail } from "@/services/issue.service";

/**
 * Problem detail (Task 11).
 *
 * Read-only view of everything captured at creation time. The AI Analysis panel
 * is a visual placeholder: no model is called, no result is invented — the real
 * workflow lands with the AI tasks.
 */

export interface IssueDetailViewProps {
  issue: IssueDetail;
  activities: SafeActivityItem[];
  attachments: IssueAttachmentItem[];
  maxAttachmentSizeBytes: number;
  canEdit: boolean;
  saved?: boolean;
}

export function IssueDetailView({
  issue,
  activities,
  attachments,
  maxAttachmentSizeBytes,
  canEdit,
  saved = false,
}: IssueDetailViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/dashboard/issues" className="inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Problems
        </Link>
      </Button>

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700"
        >
          Changes saved successfully.
        </p>
      ) : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <IssuePriorityBadge priority={issue.priority} />
            <IssueCategoryBadge category={issue.category} />
          </div>
        </div>
        {canEdit ? (
          <Button asChild>
            <Link href={`/dashboard/issues/${issue.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" /> Edit Problem
            </Link>
          </Button>
        ) : null}
      </header>

      <IssueStatusControl
        key={issue.status}
        workspaceId={issue.workspaceId}
        issueId={issue.id}
        issueTitle={issue.title}
        initialStatus={issue.status}
        canChangeStatus={canEdit}
      />

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {issue.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Captured when this problem was created.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">Category</dt>
              <dd className="text-sm font-medium">{issueCategoryLabel(issue.category)}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">Priority</dt>
              <dd className="text-sm font-medium">{issuePriorityLabel(issue.priority)}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FolderKanban className="size-3.5" aria-hidden="true" />
                Project
              </dt>
              <dd className="text-sm font-medium">
                {issue.projectId && issue.projectName ? (
                  <Link
                    href={`/dashboard/projects/${issue.projectId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {issue.projectName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {issue.projectId ? "Project unavailable" : "No project"}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="size-3.5" aria-hidden="true" />
                Created by
              </dt>
              <dd className="flex items-center gap-2 text-sm font-medium">
                {issue.creatorAvatarUrl ? (
                  <span
                    aria-hidden="true"
                    className="size-8 shrink-0 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url("${issue.creatorAvatarUrl}")` }}
                  />
                ) : null}
                {issue.creatorName ?? "Workspace member"}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5" aria-hidden="true" />
                Created
              </dt>
              <dd className="text-sm font-medium">
                <time dateTime={new Date(issue.createdAt).toISOString()}>
                  {formatDate(issue.createdAt)}
                </time>
                <span className="block text-xs font-normal text-muted-foreground">
                  {formatDateTime(issue.createdAt)}
                </span>
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5" aria-hidden="true" />
                Last updated
              </dt>
              <dd className="text-sm font-medium">
                <time dateTime={new Date(issue.updatedAt).toISOString()}>
                  {formatDate(issue.updatedAt)}
                </time>
                <span className="block text-xs font-normal text-muted-foreground">
                  {formatDateTime(issue.updatedAt)}
                </span>
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">Source</dt>
              <dd className="text-sm font-medium">{issueSourceLabel(issue.source)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <IssueAttachments
        workspaceId={issue.workspaceId}
        issueId={issue.id}
        attachments={attachments}
        maxFileSizeBytes={maxAttachmentSizeBytes}
        canManage={canEdit}
      />

      <IssueActivity activities={activities} />

      {/* Future AI workflow — placeholder only. No model call, no mock output. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            AI Analysis
          </CardTitle>
          <CardDescription>
            SolvePilot will analyze this problem and identify possible causes and recommended next
            steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">AI Analysis will be available here</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Nothing has been analyzed yet. This section stays empty until analysis is enabled for
              your workspace.
            </p>
          </div>

          <Separator className="my-5" />

          <p className="text-xs text-muted-foreground">
            Problem reference: <span className="font-mono">{issue.id}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
