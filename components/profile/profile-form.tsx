"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { FormFeedback } from "@/components/profile/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormSubmit } from "@/hooks/use-form-submit";

export interface ProfileFormProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Profile form (Task 05).
 *
 * The email is shown read-only on purpose: changing it is an account-identity
 * operation that needs its own verification flow, which is not part of this
 * task. Rendering it as a disabled field rather than hiding it keeps the user
 * informed instead of wondering where it went.
 */
export function ProfileForm({ name, email, avatarUrl }: ProfileFormProps) {
  const { pending, formError, successMessage, fieldErrors, submit } = useFormSubmit();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    submit(
      "/api/profile",
      {
        name: String(data.get("name") ?? ""),
        // An empty field means "remove the avatar", which the API maps to null.
        avatarUrl: String(data.get("avatarUrl") ?? ""),
      },
      { method: "PATCH", successMessage: "Profile saved." },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormFeedback error={formError} success={successMessage} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={name}
          required
          autoComplete="name"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
        />
        {fieldErrors.name ? (
          <p id="profile-name-error" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={email}
          disabled
          readOnly
          aria-describedby="profile-email-hint"
        />
        <p id="profile-email-hint" className="text-xs text-muted-foreground">
          Your email identifies your account and cannot be changed here.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-avatar">Avatar URL</Label>
        <Input
          id="profile-avatar"
          name="avatarUrl"
          type="url"
          inputMode="url"
          defaultValue={avatarUrl ?? ""}
          placeholder="https://example.com/avatar.png"
          aria-invalid={fieldErrors.avatarUrl ? true : undefined}
          aria-describedby={fieldErrors.avatarUrl ? "profile-avatar-error" : "profile-avatar-hint"}
        />
        {fieldErrors.avatarUrl ? (
          <p id="profile-avatar-error" className="text-sm text-destructive">
            {fieldErrors.avatarUrl}
          </p>
        ) : (
          <p id="profile-avatar-hint" className="text-xs text-muted-foreground">
            Must be an http or https image URL. Leave empty to remove it.
          </p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save profile
        </Button>
      </div>
    </form>
  );
}
