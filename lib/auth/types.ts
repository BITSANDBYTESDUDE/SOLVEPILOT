import type { DefaultSession } from "next-auth";

/**
 * Auth.js type augmentation (Task 04).
 *
 * The session object is kept deliberately small: it carries the identifier of
 * the server-side session, never the credentials or the password hash.
 * Anything richer (preferences, workspace roles) is read from the database by
 * `getCurrentUser()` so a stale cookie can never serve stale authorisation.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    /** Opaque id of the server-side session; the cookie's only real content. */
    sessionId?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "user" | "admin";
    };
  }

  interface User {
    id?: string;
    role?: "user" | "admin";
    /**
     * Opaque session id minted in `authorize` (the only callback that can see
     * the request, so the only place the user agent and IP are known) and
     * copied into the JWT. Never exposed to the client session object.
     */
    sessionId?: string;
  }
}

// The JWT interface lives in `@auth/core/jwt`; `next-auth/jwt` only re-exports
// it, and a re-export cannot be used as an augmentation target.
declare module "@auth/core/jwt" {
  interface JWT {
    /** Mirrors `Session.sessionId` — the link back to the sessions collection. */
    sessionId?: string;
    /** Absolute expiry of the underlying session document, in epoch seconds. */
    sessionExpiresAt?: number;
    id?: string;
    role?: "user" | "admin";
  }
}

/** The user shape handed to the UI. Mirrors the `users` document minus secrets. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  createdAt: Date;
}

/** Signed-in user plus the session they are using. */
export interface AuthenticatedContext {
  user: SessionUser;
  session: {
    id: string;
    sessionId: string;
    createdAt: Date;
    expiresAt: Date;
  };
}
