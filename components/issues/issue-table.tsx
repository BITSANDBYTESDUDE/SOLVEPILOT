import { ArrowRight, FolderKanban } from "lucide-react";
import Link from "next/link";

import {
  IssueCategoryBadge,
  IssuePriorityBadge,
  IssueStatusBadge,
} from "@/components/issues/issue-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { IssueSummary } from "@/services/issue.service";

/**
 * Problem rows (Task 12).
 *
 * Two presentations of the same data — a table from `md` up, tappable cards below
 * it — because a six-column table on a phone means sideways scrolling. The badges
 * come from the shared components so priority and status read the same everywhere
 * in SolvePilot.
 */

function ProjectCell({ issue }: { issue: IssueSummary }) {
  if (!issue.projectId) {
    return <span className="text-muted-foreground/70">No project</span>;
  }

  return (
    <Link
      href={`/dashboard/projects/${issue.projectId}`}
      className="inline-flex max-w-full items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
    >
      <FolderKanban className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{issue.projectName ?? "Project"}</span>
    </Link>
  );
}

/** Wide-screen table. */
export function IssueTable({ issues }: { issues: IssueSummary[] }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Problems in this workspace</caption>
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-3">
              Problem
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
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={issue.id}
              className="border-b transition-colors last:border-0 hover:bg-accent/40"
            >
              <td className="max-w-sm px-4 py-3">
                <Link
                  href={`/dashboard/issues/${issue.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {issue.title}
                </Link>
              </td>
              <td className="max-w-[12rem] px-4 py-3 text-muted-foreground">
                <ProjectCell issue={issue} />
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
              <td className="px-3 py-3 text-right">
                <Link
                  href={`/dashboard/issues/${issue.id}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  View
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Narrow-screen cards: the whole card is one tap target. */
export function IssueCards({ issues }: { issues: IssueSummary[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Link
            href={`/dashboard/issues/${issue.id}`}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <span className="font-medium text-foreground">{issue.title}</span>

            <span className="flex flex-wrap items-center gap-2">
              <IssueCategoryBadge category={issue.category} />
              <IssuePriorityBadge priority={issue.priority} />
              <IssueStatusBadge status={issue.status} />
            </span>

            <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FolderKanban className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {issue.projectId ? (issue.projectName ?? "Project") : "No project"}
                </span>
              </span>
              <time dateTime={new Date(issue.createdAt).toISOString()}>
                {formatDate(issue.createdAt)}
              </time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loading placeholder for one page of rows. Never shows invented problems. */
export function IssueListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="hidden flex-col gap-3 rounded-xl border bg-card p-4 md:flex">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-t pt-3 first:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 3) }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
