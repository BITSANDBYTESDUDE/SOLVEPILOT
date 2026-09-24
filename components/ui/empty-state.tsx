import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary/secondary actions rendered under the description. */
  action?: React.ReactNode;
}

/**
 * Shared empty state used by every list/section so "no data yet" is always
 * explained with a next step instead of a blank panel.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export { EmptyState };
