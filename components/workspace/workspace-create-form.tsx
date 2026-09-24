"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormFeedback } from "@/components/profile/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormSubmit } from "@/hooks/use-form-submit";

/**
 * Workspace creation form (Task 06).
 *
 * The slug is left optional on purpose — the server derives one from the name
 * and de-duplicates it, which is what most people expect. Filling it in keeps
 * the identifier under the user's control.
 */
export function WorkspaceCreateForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { pending, formError, successMessage, fieldErrors, submit } = useFormSubmit();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    submit(
      "/api/workspaces",
      {
        name: String(data.get("name") ?? ""),
        // Omit rather than send an empty string so the server derives the slug.
        ...(data.get("slug") ? { slug: String(data.get("slug")) } : {}),
      },
      {
        successMessage: "Workspace created. You are its owner.",
        onSuccess: () => {
          formRef.current?.reset();
          // The new workspace must show up in the list and the switcher.
          router.refresh();
        },
      },
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormFeedback error={formError} success={successMessage} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="name"
          required
          placeholder="Acme Engineering"
          autoComplete="organization"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "workspace-name-error" : undefined}
        />
        {fieldErrors.name ? (
          <p id="workspace-name-error" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-slug">
          Slug <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="workspace-slug"
          name="slug"
          placeholder="acme-engineering"
          aria-invalid={fieldErrors.slug ? true : undefined}
          aria-describedby={fieldErrors.slug ? "workspace-slug-error" : "workspace-slug-hint"}
        />
        {fieldErrors.slug ? (
          <p id="workspace-slug-error" className="text-sm text-destructive">
            {fieldErrors.slug}
          </p>
        ) : (
          <p id="workspace-slug-hint" className="text-xs text-muted-foreground">
            Lowercase letters, numbers and single hyphens. Leave empty to derive it from the name.
          </p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Create workspace
        </Button>
      </div>
    </form>
  );
}
