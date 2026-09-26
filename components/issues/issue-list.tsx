"use client";

import { Filter, ListFilter, Plus, RotateCcw, Search, SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  IssueFiltersPanel,
  LIST_SELECT_CLASS,
  type IssueFilterProject,
} from "@/components/issues/issue-filters";
import { IssueCards, IssueListSkeleton, IssueTable } from "@/components/issues/issue-table";
import { IssuePagination } from "@/components/issues/issue-pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countActiveIssueFilters,
  hasActiveIssueFilters,
  issueListQueryString,
  issueListStateToSearchParams,
  issueListStateFromParams,
  ISSUE_SORT_OPTIONS,
  type IssueListViewState,
} from "@/lib/constants/issues";
import { cn } from "@/lib/utils";
import type {
  IssueListResponse,
  IssuePagination as IssuePaginationData,
  IssueSummary,
} from "@/services/issue.service";

/**
 * Problem management list (Task 12).
 *
 * Search, filters, sorting and pagination are all executed by MongoDB through the
 * workspace issues endpoint — the browser only ever holds one page. The visible
 * state lives in the URL (defaults omitted), so a filtered page survives a
 * refresh, can be shared, and works with back/forward.
 *
 * No AI, editing, deletion or bulk actions here: listing and navigation only.
 */

const SEARCH_DEBOUNCE_MS = 400;

export interface IssueListProps {
  workspaceId: string;
  workspaceName: string;
  projects: IssueFilterProject[];
  initialData: IssueListResponse;
  initialView: IssueListViewState;
}

export function IssueList({
  workspaceId,
  workspaceName,
  projects,
  initialData,
  initialView,
}: IssueListProps) {
  const [view, setView] = React.useState<IssueListViewState>(initialView);
  const [searchInput, setSearchInput] = React.useState(initialView.search);
  const [data, setData] = React.useState<IssueListResponse>(initialData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(true);

  /**
   * Latest view for callbacks that must not go stale (debounce, popstate).
   * Written only from event handlers, never during render.
   */
  const viewRef = React.useRef(view);

  /** Ignores responses from a request a newer one has overtaken. */
  const requestRef = React.useRef(0);

  const runQuery = React.useCallback(
    async (target: IssueListViewState) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      setLoading(true);
      setError(null);

      try {
        const query = issueListStateToSearchParams(target).toString();
        const response = await fetch(
          `/api/workspaces/${workspaceId}/issues${query ? `?${query}` : ""}`,
          { headers: { accept: "application/json" } },
        );

        const body = (await response.json().catch(() => null)) as {
          success: boolean;
          data?: IssueListResponse;
          error?: { message?: string };
        } | null;

        if (requestRef.current !== requestId) return;

        if (!response.ok || !body?.success || !body.data) {
          setError(body?.error?.message ?? null);
          return;
        }

        setData({ issues: body.data.issues, pagination: body.data.pagination });
      } catch {
        if (requestRef.current === requestId) {
          setError("We could not reach the server. Check your connection and try again.");
        }
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [workspaceId],
  );

  /** Mirror the state into the address bar without a server round trip. */
  const syncUrl = React.useCallback((target: IssueListViewState, push: boolean) => {
    const url = issueListQueryString(target);
    const state = window.history.state ?? null;
    if (push) window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
  }, []);

  const applyView = React.useCallback(
    (target: IssueListViewState, options?: { push?: boolean }) => {
      viewRef.current = target;
      setView(target);
      syncUrl(target, options?.push ?? false);
      void runQuery(target);
    },
    [runQuery, syncUrl],
  );

  /** Any filter change goes back to the first page. */
  const patchFilters = React.useCallback(
    (patch: Partial<IssueListViewState>) => {
      applyView({ ...viewRef.current, ...patch, page: 1 }, { push: true });
    },
    [applyView],
  );

  // Debounced search: typing updates the input, the URL and the query trail behind.
  React.useEffect(() => {
    const term = searchInput.trim();
    if (term === viewRef.current.search.trim()) return;

    const timer = window.setTimeout(() => {
      patchFilters({ search: term });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput, patchFilters]);

  // Back/forward re-reads the URL instead of keeping a stale list on screen.
  React.useEffect(() => {
    function onPopState() {
      const next = issueListStateFromParams(new URLSearchParams(window.location.search));
      viewRef.current = next;
      setView(next);
      setSearchInput(next.search);
      void runQuery(next);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [runQuery]);

  const activeFilters = countActiveIssueFilters(view);
  const filtered = hasActiveIssueFilters(view);
  const pagination: IssuePaginationData = data.pagination;
  const issues: IssueSummary[] = data.issues;

  const clearFilters = () => {
    setSearchInput("");
    applyView(
      {
        ...viewRef.current,
        search: "",
        status: "all",
        priority: "all",
        category: "all",
        projectId: "all",
        page: 1,
      },
      { push: true },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything {workspaceName} is working through.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/issues/new">
            <Plus aria-hidden="true" />
            Create Problem
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Label htmlFor="issue-search" className="sr-only">
            Search problems
          </Label>
          <Input
            id="issue-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search problems..."
            autoComplete="off"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeFilters > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="issue-filter-panel"
          >
            <Filter aria-hidden="true" />
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </Button>

          <div className="flex items-center gap-2">
            <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Label htmlFor="issue-sort" className="sr-only">
              Sort problems
            </Label>
            <select
              id="issue-sort"
              value={view.sort}
              onChange={(event) =>
                applyView(
                  {
                    ...viewRef.current,
                    sort: event.target.value as IssueListViewState["sort"],
                    page: 1,
                  },
                  { push: true },
                )
              }
              className={cn(LIST_SELECT_CLASS, "w-auto min-w-[11rem]")}
            >
              {ISSUE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div id="issue-filter-panel" className={cn(filtersOpen ? "block" : "hidden md:block")}>
        <IssueFiltersPanel
          state={view}
          projects={projects}
          activeCount={activeFilters}
          onChange={patchFilters}
          onClear={clearFilters}
        />
      </div>

      {/* Results */}
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Unable to load problems.</AlertTitle>
          <AlertDescription>
            Something went wrong while loading your workspace problems.
            {error && error !== "Something went wrong. Please try again." ? (
              <span className="mt-1 block text-xs">({error})</span>
            ) : null}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-start-2 mt-2 w-fit"
            onClick={() => void runQuery(viewRef.current)}
          >
            <RotateCcw aria-hidden="true" />
            Try Again
          </Button>
        </Alert>
      ) : loading ? (
        <IssueListSkeleton rows={Math.max(pagination.limit, 5)} />
      ) : issues.length === 0 ? (
        pagination.total > 0 ? (
          // The workspace has problems, just not on this page — a shared link to
          // page 9, or a list that shrank since it was opened.
          <EmptyState
            icon={ListFilter}
            title="Nothing on this page"
            description={`Page ${pagination.page} of ${pagination.totalPages} is empty. The list may have changed since this link was opened.`}
            action={
              <Button variant="outline" onClick={() => applyView({ ...viewRef.current, page: 1 })}>
                Back to page 1
              </Button>
            }
          />
        ) : filtered ? (
          <EmptyState
            icon={SearchX}
            title="No problems found"
            description="Try changing your search or filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No problems yet"
            description="Create your first problem and start working toward a solution."
            action={
              <Button asChild>
                <Link href="/dashboard/issues/new">
                  <Plus aria-hidden="true" />
                  Create Problem
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-6">
          <IssueTable issues={issues} />
          <IssueCards issues={issues} />
        </div>
      )}

      {!error && !loading && pagination.total > 0 ? (
        <IssuePagination
          pagination={pagination}
          onChange={(page) => applyView({ ...viewRef.current, page })}
        />
      ) : null}
    </div>
  );
}
