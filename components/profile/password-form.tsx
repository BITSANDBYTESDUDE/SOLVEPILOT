"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { FormFeedback } from "@/components/profile/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

/**
 * Password form (Task 05).
 *
 * Fields are cleared after a successful change so the old values are not left
 * sitting in the DOM. The success message reports how many other sessions were
 * signed out, because that is a security-relevant side effect the user should
 * be told about rather than discover later.
 */
export function PasswordForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const { pending, formError, successMessage, fieldErrors, submit } = useFormSubmit();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    submit(
      "/api/profile/password",
      {
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      },
      {
        successMessage: "Password changed. Other devices have been signed out.",
        onSuccess: () => formRef.current?.reset(),
      },
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormFeedback error={formError} success={successMessage} />

      <PasswordField
        id="current-password"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
      />
      <PasswordField
        id="new-password"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={fieldErrors.newPassword}
      />
      <PasswordField
        id="confirm-password"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Change password
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  error,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
