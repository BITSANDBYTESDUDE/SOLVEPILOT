"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiFailure } from "@/types/api";

export interface AuthField {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  placeholder?: string;
}

export interface AuthFormProps {
  title: string;
  description: string;
  /** Route handler that answers with the canonical API envelope. */
  endpoint: string;
  fields: AuthField[];
  submitLabel: string;
  /** Where to land once the session cookie is set. */
  callbackUrl?: string;
  checkbox?: { name: string; label: React.ReactNode };
  footer: React.ReactNode;
}

/**
 * Credential form (Task 04).
 *
 * Posts to a route handler instead of using a Server Action so the response is
 * always the canonical `{ success, data | error }` envelope: field-level
 * validation errors land back on their inputs, and a rate-limit or credential
 * failure renders as a single alert. Server-side validation remains the
 * authority — this is presentation only.
 */
export function AuthForm({
  title,
  description,
  endpoint,
  fields,
  submitLabel,
  callbackUrl = "/dashboard",
  checkbox,
  footer,
}: AuthFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startPending] = React.useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    setFormError(null);
    setFieldErrors({});

    startPending(() => {
      void (async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

          const body = (await response.json().catch(() => null)) as {
            success: boolean;
            error?: ApiFailure["error"];
          } | null;

          if (!response.ok || !body || body.success !== true) {
            const error = body?.error;
            const details = error?.details ?? {};
            const nextFieldErrors: Record<string, string> = {};

            for (const [key, messages] of Object.entries(details)) {
              const first = messages[0];
              if (first) nextFieldErrors[key] = first;
            }

            setFieldErrors(nextFieldErrors);
            setFormError(error?.message ?? "Something went wrong. Please try again.");
            return;
          }

          // The session cookie is now set; refresh so Server Components read it.
          router.refresh();
          router.replace(callbackUrl);
        } catch {
          setFormError("We could not reach the server. Check your connection and try again.");
        }
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {fields.map((field) => {
            const error = fieldErrors[field.name];
            const describedBy = error ? `${field.name}-error` : undefined;

            return (
              <div key={field.name} className="flex flex-col gap-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                />
                {error ? (
                  <p id={`${field.name}-error`} className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}

          {checkbox ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={checkbox.name}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <input
                  id={checkbox.name}
                  name={checkbox.name}
                  type="checkbox"
                  value="true"
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                  aria-describedby={
                    fieldErrors[checkbox.name] ? `${checkbox.name}-error` : undefined
                  }
                />
                <span>{checkbox.label}</span>
              </label>
              {fieldErrors[checkbox.name] ? (
                <p id={`${checkbox.name}-error`} className="text-sm text-destructive">
                  {fieldErrors[checkbox.name]}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {submitLabel}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}{" "}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Back to home
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
