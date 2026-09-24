"use client";

import * as React from "react";

import type { ApiFailure } from "@/types/api";

/**
 * Shared submission state for forms that post to a canonical API route.
 *
 * Every SolvePilot form needs the same three states — pending, field-level
 * validation errors, and a single request-level message — so the logic lives
 * here once instead of being re-implemented per form.
 *
 * Server-side validation remains the authority; this only renders what the
 * server returned.
 */

interface SubmitOptions {
  /** HTTP verb. Defaults to POST. */
  method?: "POST" | "PATCH" | "PUT";
  /** Called after a `success: true` response. */
  onSuccess?: (data: unknown) => void;
  /** Replaces the default success message. */
  successMessage?: string;
  /** Suppress the success banner (e.g. when the caller navigates away). */
  silent?: boolean;
}

export interface FormSubmitState {
  pending: boolean;
  formError: string | null;
  successMessage: string | null;
  fieldErrors: Record<string, string>;
  submit: (endpoint: string, payload: Record<string, unknown>, options?: SubmitOptions) => void;
  resetMessages: () => void;
}

export function useFormSubmit(): FormSubmitState {
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [pending, startPending] = React.useTransition();

  const resetMessages = React.useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
  }, []);

  const submit = React.useCallback(
    (endpoint: string, payload: Record<string, unknown>, options?: SubmitOptions) => {
      setFormError(null);
      setSuccessMessage(null);
      setFieldErrors({});

      startPending(() => {
        void (async () => {
          try {
            const response = await fetch(endpoint, {
              method: options?.method ?? "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });

            const body = (await response.json().catch(() => null)) as {
              success: boolean;
              data?: unknown;
              error?: ApiFailure["error"];
            } | null;

            if (!response.ok || !body || body.success !== true) {
              const error = body?.error;
              const nextFieldErrors: Record<string, string> = {};

              for (const [key, messages] of Object.entries(error?.details ?? {})) {
                const first = messages[0];
                if (first) nextFieldErrors[key] = first;
              }

              setFieldErrors(nextFieldErrors);
              setFormError(error?.message ?? "Something went wrong. Please try again.");
              return;
            }

            options?.onSuccess?.(body.data);
            if (!options?.silent) {
              setSuccessMessage(options?.successMessage ?? "Saved.");
            }
          } catch {
            setFormError("We could not reach the server. Check your connection and try again.");
          }
        })();
      });
    },
    [],
  );

  return { pending, formError, successMessage, fieldErrors, submit, resetMessages };
}
