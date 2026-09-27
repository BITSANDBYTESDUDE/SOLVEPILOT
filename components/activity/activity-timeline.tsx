"use client";

import { Calendar, ChevronLeft, ChevronRight, Filter, History, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ActivityMessage, getActivityIcon } from "@/components/activity/activity-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { PaginatedActivities, SafeActivityItem } from "@/services/activity.service";

export interface ActivityTimelineProps {
  workspaceId: string;
  workspaceName: string;
  initialData: PaginatedActivities;
  currentFilter?: string;
  currentPage?: number;
}

function formatRelativeTime(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayLabel(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline({
  workspaceId,
  workspaceName,
  initialData,
}: ActivityTimelineProps) {
  const router = useRouter();
  const [data, setData] = React.useState<PaginatedActivities>(initialData);
  const [filterCategory, setFilterCategory] = React.useState<
    "all" | "issue" | "project" | "member" | "workspace"
  >("all");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  // Synchronize initial data
  const [prevInitial, setPrevInitial] = React.useState(initialData);
  if (prevInitial !== initialData) {
    setPrevInitial(initialData);
    setData(initialData);
  }

  const fetchPage = React.useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(targetPage),
          limit: "20",
        });

        const res = await fetch(
          `/api/workspaces/${workspaceId}/activity?${queryParams.toString()}`,
        );
        if (res.ok) {
          const body = await res.json();
          if (body?.success && body?.data) {
            setData(body.data);
            setPage(targetPage);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  // Client-side filter by category
  const filteredActivities = React.useMemo(() => {
    if (filterCategory === "all") return data.activities;
    return data.activities.filter((item) => item.action.startsWith(`${filterCategory}.`));
  }, [data.activities, filterCategory]);

  // Group by day
  const groupedActivities = React.useMemo(() => {
    const groups: Array<{ label: string; items: SafeActivityItem[] }> = [];

    for (const item of filteredActivities) {
      const dayLabel = getDayLabel(item.createdAt);
      let group = groups.find((g) => g.label === dayLabel);
      if (!group) {
        group = { label: dayLabel, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }

    return groups;
  }, [filteredActivities]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit history and team actions in{" "}
            <strong className="font-medium text-foreground">{workspaceName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchPage(page);
              router.refresh();
            }}
            disabled={loading}
          >
            <RotateCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>

        <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
          {(
            [
              { id: "all", label: "All Activities" },
              { id: "issue", label: "Problems" },
              { id: "project", label: "Projects" },
              { id: "member", label: "Members" },
              { id: "workspace", label: "Workspace" },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCategory(cat.id)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterCategory === cat.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      {filteredActivities.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <History className="size-6" aria-hidden="true" />
            </div>
            <CardTitle className="mt-3 text-base font-semibold">No activity yet</CardTitle>
            <CardDescription className="text-sm">
              Important workspace actions like creating problems and projects, and updating members,
              will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {groupedActivities.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <div className="flex-1 border-t" />
              </div>

              <div className="relative ml-2 flex flex-col gap-4 border-l border-muted-foreground/20 pl-6">
                {group.items.map((item) => (
                  <div key={item.id} className="relative flex items-start justify-between gap-4">
                    {/* Bullet Icon */}
                    <div className="absolute -left-[31px] flex size-6 items-center justify-center rounded-full border bg-background shadow-xs">
                      {getActivityIcon(item.action)}
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="text-sm text-foreground">
                        <ActivityMessage activity={item} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span title={formatDateTime(item.createdAt)}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-[10px] text-muted-foreground/80">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px] text-muted-foreground"
                    >
                      {item.action}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total}{" "}
            total)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(data.pagination.page - 1)}
              disabled={data.pagination.page <= 1 || loading}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(data.pagination.page + 1)}
              disabled={data.pagination.page >= data.pagination.totalPages || loading}
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
