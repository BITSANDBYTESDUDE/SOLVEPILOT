import "server-only";

import NextAuth from "next-auth";

import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/session";
import { sessionCookieConfig } from "@/lib/auth/session-cookie";
import "@/lib/auth/types";
import { logger } from "@/lib/logger";

const log = logger.child("auth");

/**
 * Auth.js wiring (Task 04).
 *
 * Responsibility is split deliberately, so there is exactly one way to
 * authenticate:
 *
 *  - `POST /api/auth/login` and `/api/auth/register` verify credentials and
 *    mint the session. They exist because Auth.js's own credentials callback
 *    answers with a redirect, while every SolvePilot endpoint must answer with
 *    the canonical `{ success, data | error }` envelope.
 *  - This module is what *reads* the session: `auth()` decrypts the cookie and
 *    `callbacks.session` re-validates it against the `sessions` collection.
 *
 * The Credentials provider is intentionally NOT registered. Leaving it in
 * would expose a second, unused sign-in route
 * (`/api/auth/callback/credentials`) that nothing tests and nothing needs.
 *
 * Trust model: the cookie is an encrypted envelope around an opaque session
 * id. Nothing in it is trusted on its own — a session that was revoked,
 * expired or reassigned produces no session here, which is what makes logout
 * real rather than cosmetic.
 */
// Only `auth()` is used. The Auth.js route handler is deliberately not mounted
// (no `app/api/auth/[...nextauth]`): it would expose its own `/api/auth/session`,
// which echoes the token payload *without* the database re-validation that
// `lib/auth/guards` performs — a weaker answer to the same question.
export const { auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  // Shared with the credential route handlers so both sides agree on the name.
  cookies: sessionCookieConfig,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [],
  callbacks: {
    async session({ session, token }) {
      const sessionId = token.sessionId;
      const userId = token.id;

      if (typeof sessionId !== "string" || typeof userId !== "string") {
        // No session id is the signal the guards reject on.
        session.sessionId = undefined;
        return session;
      }

      // The database is the source of truth, regardless of what the cookie says.
      const record = await getSession(sessionId);
      if (!record || record.userId !== userId) {
        log.info("session cookie rejected", { reason: record ? "user mismatch" : "not found" });
        session.sessionId = undefined;
        return session;
      }

      session.sessionId = sessionId;
      session.user.id = record.userId;
      // `expires` and `role` are deliberately not set here: Auth.js types
      // `expires` as the adapter shape (`Date & string`), and a role baked
      // into a token would go stale. `getCurrentUser()` reads both from the
      // user document on every request, so a role change takes effect at once.

      return session;
    },
  },
  logger: {
    error(error) {
      log.error("Auth.js error", error);
    },
  },
});
