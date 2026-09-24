import "server-only";

import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";

import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { getServerEnv, requireEnv } from "@/lib/config/env";

/**
 * Session cookie (Task 04).
 *
 * One definition, used by both sides of the flow:
 *  - the credential route handlers write it,
 *  - Auth.js's `auth()` reads it (`cookies.sessionToken` below).
 *
 * The cookie value is an Auth.js JWE (encrypted with `AUTH_SECRET`), so its
 * contents are unreadable to the browser. It carries only the opaque session
 * id — never a user id, role or anything else that could be trusted if the
 * encryption were ever bypassed.
 */

function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}

/**
 * Cookie name.
 *
 * The `__Host-` prefix is enforced by browsers and additionally requires
 * `Secure`, `Path=/` and no `Domain`, which stops a sibling subdomain from
 * reading or overwriting the cookie. It cannot be used over plain HTTP, so
 * development keeps the unprefixed name.
 */
export function sessionCookieName(): string {
  return isProduction() ? "__Host-solvepilot.session" : "solvepilot.session";
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

function authSecret(): string {
  return requireEnv(
    "AUTH_SECRET",
    "Generate one with: openssl rand -base64 32 and add it to .env.local (see .env.example).",
  );
}

export interface SessionTokenPayload {
  /** Opaque id of the row in the `sessions` collection. */
  sessionId: string;
  userId: string;
  /** Absolute session expiry, in epoch seconds. */
  expiresAt: number;
}

/** Encrypt a session payload into the cookie value Auth.js will accept. */
export async function encodeSessionToken(payload: SessionTokenPayload): Promise<string> {
  return encode({
    token: {
      sessionId: payload.sessionId,
      id: payload.userId,
      sessionExpiresAt: payload.expiresAt,
    },
    secret: authSecret(),
    // Auth.js derives its key from `secret + salt`, and the salt is the cookie
    // name — so the name must match or `auth()` cannot decrypt what we wrote.
    salt: sessionCookieName(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Decrypt the incoming cookie. Returns `null` when it is missing or invalid. */
export async function readSessionToken(): Promise<SessionTokenPayload | null> {
  const name = sessionCookieName();
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;

  try {
    const token = await decode({ token: value, secret: authSecret(), salt: name });
    const sessionId = token?.sessionId;
    const userId = token?.id;

    if (typeof sessionId !== "string" || typeof userId !== "string") return null;

    return {
      sessionId,
      userId,
      expiresAt: typeof token?.sessionExpiresAt === "number" ? token.sessionExpiresAt : 0,
    };
  } catch {
    // Wrong secret, tampered value or a cookie from another deployment.
    return null;
  }
}

/** Attach the session cookie to an outgoing response. */
export function setSessionCookie(response: Response, token: string, expiresAt: Date): Response {
  response.headers.append(
    "set-cookie",
    serializeCookie(sessionCookieName(), token, {
      ...sessionCookieOptions,
      expires: expiresAt,
      secure: isProduction(),
    }),
  );
  return response;
}

/** Expire the session cookie immediately. */
export function clearSessionCookie(response: Response): Response {
  response.headers.append(
    "set-cookie",
    serializeCookie(sessionCookieName(), "", {
      ...sessionCookieOptions,
      expires: new Date(0),
      secure: isProduction(),
    }),
  );
  return response;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    expires: Date;
    secure: boolean;
  },
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Expires=${options.expires.toUTCString()}`,
    `SameSite=${capitalize(options.sameSite)}`,
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The Auth.js cookie config — kept here so both sides agree on the name. */
export const sessionCookieConfig = {
  sessionToken: {
    name: sessionCookieName(),
    options: {
      ...sessionCookieOptions,
      secure: isProduction(),
    },
  },
};
