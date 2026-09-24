import { z } from "zod";

import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/constants";
import { THEMES } from "@/types/domain";

/**
 * Profile and preference validators (Task 05).
 *
 * Everything reaching the database passes through here first, so Mongoose
 * validation stays the last line of defence rather than the first.
 */

/**
 * Avatar URLs are rendered inside `<img src>`, so the scheme is restricted.
 * A `javascript:` URL would be an XSS vector (§40) and is rejected here rather
 * than trusted to the browser.
 */
const avatarUrlSchema = z
  .union([
    z
      .string()
      .trim()
      .url("Enter a valid image URL.")
      .max(2048, "Image URLs must be 2048 characters or fewer.")
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Image URLs must start with http:// or https://.",
      }),
    z.literal("").transform(() => null),
  ])
  .optional()
  .transform((value) => (value === undefined ? undefined : value));

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(NAME_MIN_LENGTH, `Your name must be at least ${NAME_MIN_LENGTH} characters.`)
      .max(NAME_MAX_LENGTH, `Your name must be ${NAME_MAX_LENGTH} characters or fewer.`)
      .optional(),
    avatarUrl: avatarUrlSchema,
  })
  .refine((value) => value.name !== undefined || value.avatarUrl !== undefined, {
    message: "Provide at least one field to update.",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePreferencesSchema = z.object({
  theme: z.enum(THEMES, { message: "Choose light, dark or system." }).optional(),
  emailNotifications: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true" || value === "on")
    .optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.`,
      )
      .max(PASSWORD_MAX_LENGTH, `Passwords must be ${PASSWORD_MAX_LENGTH} characters or fewer.`),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The email limit is shared with registration so both agree. */
export const PROFILE_EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
