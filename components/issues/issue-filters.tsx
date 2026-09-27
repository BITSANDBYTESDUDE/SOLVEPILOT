"use client";

import { FolderKanban, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ALL_FILTER,
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  NO_PROJECT_FILTER,
  type IssueListViewState,
} from "@/lib/constants/issues";
import { cn } from "@/lib/utils";

/**
 * Problem filters (Task 12).
 *
 * A single panel owning the four narrowings — status, priority, category and
 * project — plus the reset. Every control writes to the URL through its parent,
 * so a filtered view is refreshable and shareable.
 */

/** Shared look for the native selects used across the list toolbar. */
export const LIST_SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

export interface IssueFilterProject {
  id: string;
  name: string;
  status: "active" | "archived";
}

interface Option {
  value: string;
  label: string;
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  icon,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(LIST_SELECT_CLASS, icon && "pl-8")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export interface IssueFiltersPanelProps {
  state: IssueListViewState;
  projects: IssueFilterProject[];
  activeCount: number;
  disabled?: boolean;
  onChange: (patch: Partial<IssueListViewState>) => void;
  onClear: () => void;
}

export function IssueFiltersPanel({
  state,
  projects,
  activeCount,
  disabled,
  onChange,
  onClear,
}: IssueFiltersPanelProps) {
  const projectOptions: Option[] = [
    { value: ALL_FILTER, label: "All Projects" },
    ...projects.map((project) => ({
      value: project.id,
      label: project.status === "archived" ? `${project.name} (Archived)` : project.name,
    })),
    { value: NO_PROJECT_FILTER, label: "No Project" },
  ];

  return (
    <section
      aria-label="Problem filters"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Filters{activeCount > 0 ? ` (${activeCount})` : ""}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={disabled || activeCount === 0}
        >
          <X aria-hidden="true" />
          Clear Filters
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="filter-status"
          label="Status"
          value={state.status}
          disabled={disabled}
          onChange={(value) => onChange({ status: value as IssueListViewState["status"] })}
          options={[
            { value: ALL_FILTER, label: "All" },
            ...ISSUE_STATUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          ]}
        />

        <FilterSelect
          id="filter-priority"
          label="Priority"
          value={state.priority}
          disabled={disabled}
          onChange={(value) => onChange({ priority: value as IssueListViewState["priority"] })}
          options={[
            { value: ALL_FILTER, label: "All" },
            ...ISSUE_PRIORITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          ]}
        />

        <FilterSelect
          id="filter-category"
          label="Category"
          value={state.category}
          disabled={disabled}
          onChange={(value) => onChange({ category: value as IssueListViewState["category"] })}
          options={[
            { value: ALL_FILTER, label: "All" },
            ...ISSUE_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          ]}
        />

        <FilterSelect
          id="filter-project"
          label="Project"
          value={state.projectId}
          disabled={disabled}
          onChange={(value) => onChange({ projectId: value })}
          options={projectOptions}
          icon={<FolderKanban className="size-3.5" aria-hidden="true" />}
        />
      </div>
    </section>
  );
}
