import { z } from "zod";

import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/constants";

/**
 * Input validators for the credential endpoints (Task 04).
 *
 * Everything reaching a service or the database passes through here first:
 * Mongoose validation stays as the last line of defence, not the first.
 * Messages are written for end users because they are surfaced in the form UI.
 */

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(EMAIL_MAX_LENGTH, `Email addresses must be ${EMAIL_MAX_LENGTH} characters or fewer.`)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(1, "Enter your password.")
  .max(PASSWORD_MAX_LENGTH, `Passwords must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN_LENGTH, `Your name must be at least ${NAME_MIN_LENGTH} characters.`)
    .max(NAME_MAX_LENGTH, `Your name must be ${NAME_MAX_LENGTH} characters or fewer.`),
  email: emailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH, `Passwords must be ${PASSWORD_MAX_LENGTH} characters or fewer.`),
  /** Registration is explicitly opt-in, so the box must be ticked. */
  acceptTerms: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true" || value === "on")
    .refine((accepted) => accepted, {
      message: "Accept the terms to create an account.",
    }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Parse with a consistent failure type.
 *
 * Returns the field-keyed detail map the canonical API envelope expects rather
 * than throwing, so form actions can re-render the page with inline errors.
 */
export function parseCredentials<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
):
  | { success: true; data: z.infer<TSchema> }
  | { success: false; details: Record<string, string[]>; message: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const bucket = details[key] ?? [];
    bucket.push(issue.message);
    details[key] = bucket;
  }

  const firstIssue = result.error.issues[0];
  return {
    success: false,
    details,
    message: firstIssue?.message ?? "Invalid request data.",
  };
}
