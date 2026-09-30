"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ISSUE_CATEGORY_OPTIONS,
  ISSUE_DESCRIPTION_MAX_LENGTH,
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_TITLE_MAX_LENGTH,
  issueDraftErrors,
} from "@/lib/constants/issues";
import type { IssueCategory, IssuePriority } from "@/types/domain";

export interface EditableIssueValues {
  title: string;
  description: string;
  projectId: string | null;
  category: IssueCategory;
  priority: IssuePriority;
}

export interface EditIssueProject {
  id: string;
  name: string;
}

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

export function IssueEditForm({
  workspaceId,
  issueId,
  initialValues,
  projects,
}: {
  workspaceId: string;
  issueId: string;
  initialValues: EditableIssueValues;
  projects: EditIssueProject[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const dirty =
    values.title !== initialValues.title ||
    values.description !== initialValues.description ||
    values.projectId !== initialValues.projectId ||
    values.category !== initialValues.category ||
    values.priority !== initialValues.priority;

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = <K extends keyof EditableIssueValues>(key: K, value: EditableIssueValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const cancel = () => {
    if (dirty && !window.confirm("You have unsaved changes. Are you sure you want to leave?"))
      return;
    router.push(`/dashboard/issues/${issueId}`);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const validation = issueDraftErrors(values);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const body = payload as {
          error?: { message?: string; details?: Record<string, string[]> };
        };
        setErrors(
          Object.fromEntries(
            Object.entries(body.error?.details ?? {}).map(([key, messages]) => [
              key,
              messages[0] ?? "",
            ]),
          ),
        );
        setFormError(
          response.status === 403
            ? "You don't have permission to edit this problem."
            : "Unable to save changes. Please try again.",
        );
        return;
      }
      router.refresh();
      router.push(`/dashboard/issues/${issueId}?saved=1`);
    } catch {
      setFormError("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button type="button" variant="ghost" size="sm" className="mb-4 w-fit" onClick={cancel}>
          ← Back to Problem
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Problem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the information for this problem.
        </p>
      </div>
      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save changes.</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Problem information</CardTitle>
          <CardDescription>
            Update the title, details, project, category, or priority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Problem Title</Label>
              <Input
                id="edit-title"
                value={values.title}
                maxLength={ISSUE_TITLE_MAX_LENGTH}
                onChange={(event) => update("title", event.target.value)}
                disabled={saving}
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.title}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={7}
                value={values.description}
                maxLength={ISSUE_DESCRIPTION_MAX_LENGTH}
                onChange={(event) => update("description", event.target.value)}
                disabled={saving}
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project">Project</Label>
              <select
                id="edit-project"
                className={SELECT_CLASS}
                value={values.projectId ?? ""}
                disabled={saving}
                onChange={(event) => update("projectId", event.target.value || null)}
              >
                <option value="">No Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {errors.projectId ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.projectId}
                </p>
              ) : null}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <select
                  id="edit-category"
                  className={SELECT_CLASS}
                  value={values.category}
                  disabled={saving}
                  onChange={(event) => update("category", event.target.value as IssueCategory)}
                >
                  {ISSUE_CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {errors.category ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.category}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <select
                  id="edit-priority"
                  className={SELECT_CLASS}
                  value={values.priority}
                  disabled={saving}
                  onChange={(event) => update("priority", event.target.value as IssuePriority)}
                >
                  {ISSUE_PRIORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {errors.priority ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.priority}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" /> Saving…
                  </>
                ) : (
                  <>
                    <Save aria-hidden="true" /> Save Changes
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
