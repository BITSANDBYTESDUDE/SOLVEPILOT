import { FolderKanban, Inbox, Plus } from "lucide-react";
import Link from "next/link";

import {
  IssueCategoryBadge,
  IssuePriorityBadge,
  IssueStatusBadge,
} from "@/components/issues/issue-badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { IssueSummary } from "@/services/issue.service";

/**
 * Problem list (Task 11).
 *
 * A plain recency list of the current workspace's problems — search, filtering,
 * sorting and pagination are Task 12, so this component intentionally has no
 * query controls yet.
 */

export interface IssueListProps {
  issues: IssueSummary[];
  workspaceName: string;
}

export function IssueList({ issues, workspaceName }: IssueListProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything {workspaceName} is working through, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/issues/new">
            <Plus aria-hidden="true" />
            Create Problem
          </Link>
        </Button>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No problems yet."
          description="Create your first problem and let SolvePilot guide you toward a solution."
          action={
            <Button asChild>
              <Link href="/dashboard/issues/new">
                <Plus aria-hidden="true" />
                Create Problem
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">Problems in {workspaceName}, newest first</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3">
                  Title
                </th>
                <th scope="col" className="px-4 py-3">
                  Project
                </th>
                <th scope="col" className="px-4 py-3">
                  Category
                </th>
                <th scope="col" className="px-4 py-3">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr
                  key={issue.id}
                  className="border-b transition-colors last:border-0 hover:bg-accent/40"
                >
                  <td className="max-w-md px-4 py-3">
                    <Link
                      href={`/dashboard/issues/${issue.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {issue.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.projectId ? (
                      <Link
                        href={`/dashboard/projects/${issue.projectId}`}
                        className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
                      >
                        <FolderKanban className="size-3.5" aria-hidden="true" />
                        {issue.projectName ?? "Project"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/70">No project</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <IssueCategoryBadge category={issue.category} />
                  </td>
                  <td className="px-4 py-3">
                    <IssuePriorityBadge priority={issue.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <IssueStatusBadge status={issue.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    <time dateTime={new Date(issue.createdAt).toISOString()}>
                      {formatDate(issue.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
