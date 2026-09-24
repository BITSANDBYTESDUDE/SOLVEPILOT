import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AuthenticatedContext, SessionUser } from "@/lib/auth/types";
import { isDatabaseConfigured } from "@/lib/db/connect";
import { InternalError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { Types } from "mongoose";

import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/constants";
import { User, type UserDocument } from "@/models";
import { getSession } from "@/lib/auth/session";

const log = logger.child("auth:guards");

/**
 * Server-side authentication gates (Task 04).
 *
 * Two flavours, because the two callers need different failure modes:
 *  - pages call `requireUser()`, which redirects to `/login`,
 *  - route handlers call `requireApiUser()`, which throws a 401 the canonical
 *    error envelope can render.
 *
 * In both cases the session cookie is not trusted on its own: the session
 * document is re-read, and the user is loaded fresh so a deleted account or a
 * changed role takes effect immediately.
 */

/**
 * Whether a session can be validated at all.
 *
 * Sessions live in MongoDB, so without `MONGODB_URI` nobody can be
 * authenticated. Checked explicitly by the guards so a missing database fails
 * *closed* (access refused) instead of silently looking like "not signed in".
 */
export function isAuthenticationAvailable(): boolean {
  return isDatabaseConfigured();
}

/**
 * Resolve the signed-in user, or `null` when there is no valid session.
 *
 * Returns `null` (rather than throwing) when authentication is unavailable, so
 * a deployment without `MONGODB_URI` still renders its public pages and its
 * sign-in form. Protected routes must not rely on this distinction — they go
 * through `requireUser()` / `requireApiUser()`, which fail closed.
 */
export async function getCurrentUser(): Promise<AuthenticatedContext | null> {
  if (!isAuthenticationAvailable()) return null;

  const session = await auth();
  const sessionId = session?.sessionId;
  const sessionUserId = session?.user?.id;

  if (!sessionId || !sessionUserId) return null;

  const record = await getSession(sessionId);
  if (!record || record.userId !== sessionUserId) return null;

  const user = await User.findById(record.userId).lean<
    (UserDocument & { _id: Types.ObjectId }) | null
  >();
  if (!user) {
    // Account was deleted while the session was still valid — end it.
    log.warn("session points at a missing user", { userId: record.userId });
    return null;
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      createdAt: user.createdAt,
    },
    session: {
      id: record.id,
      sessionId: record.sessionId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    },
  };
}

/** Like `getCurrentUser`, but for API routes: throws instead of returning null. */
export async function requireApiUser(): Promise<AuthenticatedContext> {
  if (!isAuthenticationAvailable()) {
    throw new UnauthorizedError(AUTH_NOT_CONFIGURED_MESSAGE);
  }

  const context = await getCurrentUser();
  if (!context) throw new UnauthorizedError();
  return context;
}

/**
 * Gate for Server Components. Redirects to `/login` with a `callbackUrl` so the
 * user returns to the page they originally asked for after signing in.
 */
export async function requireUser(protectedPath = "/dashboard"): Promise<AuthenticatedContext> {
  if (!isAuthenticationAvailable()) {
    // Fail closed, and say why. Redirecting to /login instead would loop: the
    // login form would render, and signing in could never work.
    log.error("protected route reached without a usable session store");
    throw new InternalError("Authentication is unavailable because MONGODB_URI is not configured.");
  }

  const context = await getCurrentUser();
  if (context) return context;

  redirect(`/login?callbackUrl=${encodeURIComponent(protectedPath)}`);
}

/** Cheap boolean for UI that merely adapts to the signed-in state. */
export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

export type { SessionUser };
