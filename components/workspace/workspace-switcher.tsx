"use client";

import { Building2, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitcherWorkspace {
  id: string;
  name: string;
  role: string;
}

/**
 * Workspace switcher (Task 06).
 *
 * A native `<select>` rather than a custom dropdown: it is keyboard and screen
 * reader correct for free, and the design system has no dropdown primitive that
 * would justify adding one here.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: SwitcherWorkspace[];
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const active =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const workspaceId = event.target.value;
    if (!workspaceId || workspaceId === active?.id) return;

    setPending(true);
    try {
      await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
    } finally {
      // Refresh either way: if the switch failed the select must show the
      // workspace that is actually active, not the one the click asked for.
      setPending(false);
      router.refresh();
    }
  }

  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground">
        <Building2 className="size-4" aria-hidden="true" />
        No workspace yet
      </span>
    );
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Active workspace</span>
      <Building2
        className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        value={active.id}
        onChange={onChange}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          "h-9 max-w-52 cursor-pointer appearance-none rounded-md border border-input bg-background py-1 pr-8 pl-8 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className={cn(
          "pointer-events-none absolute right-2.5 size-4 text-muted-foreground",
          pending && "animate-pulse",
        )}
        aria-hidden="true"
      />
    </label>
  );
}
