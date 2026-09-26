"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IssuePagination as IssuePaginationData } from "@/services/issue.service";
import { cn } from "@/lib/utils";

/**
 * Pagination controls (Task 12).
 *
 * The page size and the total come from the server; this component only asks for
 * another page. A window of page buttons keeps the control usable when a workspace
 * has hundreds of pages.
 */

const WINDOW = 2;

/** Page numbers to render, with `null` marking an ellipsis. */
export function pageWindow(page: number, totalPages: number): Array<number | null> {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages, page]);
  for (let offset = 1; offset <= WINDOW; offset += 1) {
    if (page - offset > 1) pages.add(page - offset);
    if (page + offset < totalPages) pages.add(page + offset);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps: Array<number | null> = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) withGaps.push(null);
    withGaps.push(value);
  });

  return withGaps;
}

export interface IssuePaginationProps {
  pagination: IssuePaginationData;
  disabled?: boolean;
  onChange: (page: number) => void;
}

export function IssuePagination({ pagination, disabled, onChange }: IssuePaginationProps) {
  const { page, limit, total, totalPages, hasNextPage, hasPreviousPage } = pagination;

  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Problem pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p aria-live="polite" className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>{" "}
        {total === 1 ? "problem" : "problems"}
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={disabled || !hasPreviousPage}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((value, index) =>
            value === null ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={value}
                type="button"
                variant={value === page ? "default" : "outline"}
                size="sm"
                aria-current={value === page ? "page" : undefined}
                className={cn("min-w-9 tabular-nums")}
                onClick={() => onChange(value)}
                disabled={disabled}
              >
                {value}
              </Button>
            ),
          )}
        </div>

        <span className="px-2 text-xs text-muted-foreground sm:hidden">
          Page {page} of {totalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={disabled || !hasNextPage}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
