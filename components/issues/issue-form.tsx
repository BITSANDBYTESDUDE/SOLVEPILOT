"use client";

import { ChevronUp, CircleDot, Loader2, Minus, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormSubmit } from "@/hooks/use-form-submit";
import {
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_DESCRIPTION_MAX_LENGTH,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_TITLE_MAX_LENGTH,
  issueDraftErrors,
} from "@/lib/constants/issues";
import { cn } from "@/lib/utils";
import type { IssueCategory, IssuePriority } from "@/types/domain";

/**
 * Create a Problem form (Task 11).
 *
 * A focused workflow rather than a generic form: title, description, an optional
 * project, then an explicit category and priority choice. The workspace comes
 * from the server; only the problem's own content is sent, so the server stays
 * the authority on `workspaceId`, `createdBy`, `status` and `source`.
 */

export interface IssueFormProject {
  id: string;
  name: string;
  color: string;
  status: "active" | "archived";
}

export interface IssueFormProps {
  workspaceId: string;
  /** Projects of the *current* workspace only — resolved server-side. */
  projects: IssueFormProject[];
  defaultProjectId?: string | null;
}

const PRIORITY_ICONS = {
  low: Minus,
  medium: CircleDot,
  high: ChevronUp,
  critical: TriangleAlert,
} as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

export function IssueForm({ workspaceId, projects, defaultProjectId = null }: IssueFormProps) {
  const router = useRouter();
  const { pending, formError, fieldErrors, submit } = useFormSubmit();

  // A project pre-selected through a link must be one of this workspace's
  // projects; anything else is dropped here and would be rejected server-side.
  const initialProjectId =
    defaultProjectId !== null && projects.some((project) => project.id === defaultProjectId)
      ? defaultProjectId
      : "";

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [projectId, setProjectId] = React.useState<string>(initialProjectId);
  const [category, setCategory] = React.useState<IssueCategory>(DEFAULT_ISSUE_CATEGORY);
  const [priority, setPriority] = React.useState<IssuePriority>(DEFAULT_ISSUE_PRIORITY);
  const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});

  const submitting = pending;
  const errors = { ...localErrors, ...fieldErrors };
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const draftErrors = issueDraftErrors({ title, description });
    setLocalErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) return;

    submit(
      `/api/workspaces/${workspaceId}/issues`,
      {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        projectId: projectId || undefined,
      },
      {
        silent: true,
        onSuccess: (data) => {
          const created = (data as { issue?: { id?: string } } | null)?.issue;
          if (created?.id) {
            router.refresh();
            router.push(`/dashboard/issues/${created.id}`);
            return;
          }
          router.push("/dashboard/issues");
        },
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a Problem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe the problem and SolvePilot will help you work toward a solution.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>We couldn&apos;t create this problem.</AlertTitle>
          <AlertDescription>
            {formError === "Something went wrong. Please try again."
              ? "Please check your information and try again."
              : formError}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Problem details</CardTitle>
          <CardDescription>
            Say what is going wrong and where. The more specific the description, the better the
            guidance SolvePilot can give later.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            {/* Title */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <Label htmlFor="issue-title">Problem Title</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {title.trim().length}/{ISSUE_TITLE_MAX_LENGTH}
                </span>
              </div>
              <p id="issue-title-help" className="text-xs text-muted-foreground">
                What problem are you trying to solve?
              </p>
              <Input
                id="issue-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Mobile navbar is broken"
                maxLength={ISSUE_TITLE_MAX_LENGTH}
                autoComplete="off"
                aria-describedby="issue-title-help"
                aria-invalid={errors.title ? true : undefined}
                disabled={submitting}
                required
              />
              {errors.title ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.title}
                </p>
              ) : null}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <Label htmlFor="issue-description">Description</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {description.trim().length}/{ISSUE_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="issue-description"
                name="description"
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the problem in detail..."
                maxLength={ISSUE_DESCRIPTION_MAX_LENGTH}
                aria-invalid={errors.description ? true : undefined}
                disabled={submitting}
                required
              />
              {errors.description ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.description}
                </p>
              ) : null}
            </div>

            {/* Project */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-project">
                Project
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              {projects.length === 0 ? (
                <>
                  <select id="issue-project" name="projectId" className={SELECT_CLASS} disabled>
                    <option value="">No projects available</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    This workspace has no projects yet. You can still create a problem without one.
                  </p>
                </>
              ) : (
                <select
                  id="issue-project"
                  name="projectId"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={SELECT_CLASS}
                  disabled={submitting}
                >
                  <option value="">No Project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.status === "archived" ? " (Archived)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedProject ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-2.5 rounded-full border"
                    style={{ backgroundColor: selectedProject.color }}
                    aria-hidden="true"
                  />
                  This problem will be filed under {selectedProject.name}.
                </p>
              ) : null}
              {errors.projectId ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.projectId}
                </p>
              ) : null}
            </div>

            {/* Category */}
            <fieldset className="flex flex-col gap-3" disabled={submitting}>
              <legend className="text-sm font-medium">Category</legend>
              <p className="-mt-2 text-xs text-muted-foreground">What kind of problem is this?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ISSUE_CATEGORY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      category === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-input hover:bg-accent/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={category === option.value}
                      onChange={() => setCategory(option.value)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Priority */}
            <fieldset className="flex flex-col gap-3" disabled={submitting}>
              <legend className="text-sm font-medium">Priority</legend>
              <p className="-mt-2 text-xs text-muted-foreground">
                How urgently does this need attention?
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {ISSUE_PRIORITY_OPTIONS.map((option) => {
                  const Icon = PRIORITY_ICONS[option.value];
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                        priority === option.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-input hover:bg-accent/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={option.value}
                        checked={priority === option.value}
                        onChange={() => setPriority(option.value)}
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="size-3.5" aria-hidden="true" />
                          {option.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{option.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
              <Button type="button" variant="outline" asChild disabled={submitting}>
                <Link href="/dashboard/issues">Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" />
                    Create Problem
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
