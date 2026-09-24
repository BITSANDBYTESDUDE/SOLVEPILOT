import "server-only";

import { Types } from "mongoose";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeOtherSessionsForUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/connect";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { User, type UserDocument, type UserPreferences } from "@/models";
import { DEFAULT_USER_PREFERENCES } from "@/models/user.model";
import {
  changePasswordSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "@/validators/profile";
import type { Theme } from "@/types/domain";

const log = logger.child("profile:service");

/** A `users` document as read back from the driver: the id is always present. */
type StoredUser = UserDocument & { _id: Types.ObjectId };

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Profile service (Task 05).
 *
 * Authorization note: every function takes the `userId` resolved from the
 * session on the server. No caller can supply an arbitrary id, so there is no
 * path to editing somebody else's profile (§40, IDOR).
 */

export async function getProfile(userId: string): Promise<Profile> {
  await connectToDatabase();

  const user = await User.findById(userId).lean<StoredUser | null>();
  if (!user) throw new NotFoundError("Your account could not be found.");

  return toProfile(user);
}

export async function updateProfile(userId: string, input: unknown): Promise<Profile> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid profile data.");
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("Provide at least one field to update.");
  }

  await connectToDatabase();

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true },
  ).lean<StoredUser | null>();
  if (!user) throw new NotFoundError("Your account could not be found.");

  log.info("profile updated", { userId, fields: Object.keys(updates) });
  return toProfile(user);
}

export async function updatePreferences(
  userId: string,
  input: unknown,
): Promise<{ preferences: UserPreferences }> {
  const parsed = updatePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid preference data.");
  }

  const { theme, emailNotifications } = parsed.data;

  if (theme === undefined && emailNotifications === undefined) {
    throw new ValidationError("Provide at least one preference to update.");
  }

  // Dotted paths so a partial update never wipes the other preference.
  const updates: Record<string, unknown> = {};
  if (theme !== undefined) updates["preferences.theme"] = theme;
  if (emailNotifications !== undefined) {
    updates["preferences.emailNotifications"] = emailNotifications;
  }

  await connectToDatabase();

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true },
  ).lean<StoredUser | null>();
  if (!user) throw new NotFoundError("Your account could not be found.");

  log.info("preferences updated", { userId, fields: Object.keys(updates) });
  return { preferences: withDefaults(user.preferences) };
}

/**
 * Change the account password.
 *
 * Every *other* session is revoked, so a stolen cookie stops working. The
 * session performing the change stays alive — otherwise saving a new password
 * would immediately sign the user out, which reads as a bug.
 */
export async function changePassword(
  userId: string,
  input: unknown,
  context: { keepSessionHash?: string } = {},
): Promise<{ revokedSessions: number }> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid password data.");
  }

  const { currentPassword, newPassword } = parsed.data;

  await connectToDatabase();

  // `passwordHash` is `select: false` — it must be asked for explicitly.
  const user = await User.findById(userId)
    .select("+passwordHash")
    .lean<(StoredUser & { passwordHash?: string }) | null>();
  if (!user) throw new NotFoundError("Your account could not be found.");

  const currentMatches = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentMatches) {
    log.warn("password change rejected: current password incorrect", { userId });
    throw new UnauthorizedError("Your current password is incorrect.");
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword) } },
  );

  const revokedSessions = await revokeOtherSessionsForUser(userId, context.keepSessionHash);
  log.info("password changed", { userId, revokedSessions });

  return { revokedSessions };
}

/** Guard against documents written before a preference existed. */
function withDefaults(preferences: UserPreferences | undefined): UserPreferences {
  return {
    theme: (preferences?.theme ?? DEFAULT_USER_PREFERENCES.theme) as Theme,
    emailNotifications:
      preferences?.emailNotifications ?? DEFAULT_USER_PREFERENCES.emailNotifications,
  };
}

function toProfile(user: StoredUser): Profile {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    preferences: withDefaults(user.preferences),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
