/**
 * Authentication verification tooling (Task 04).
 *
 * Asserts the security behaviour the credential flow depends on, without
 * needing a database or the Next.js runtime: password hashing rules, the
 * enumeration-proofing of a failed sign-in, credential validation, session id
 * generation/hashing and the brute-force limiter.
 *
 * The database-backed paths (session create/lookup/revoke) are covered by
 * `npm run db:verify` for their schema, and need a live MONGODB_URI to exercise
 * end to end.
 *
 * Usage:  npm run auth:verify
 */
import { createRequire } from "node:module";

// A throwaway secret: this script never touches real credentials.
process.env.AUTH_SECRET ??= "auth-verify-only-secret-not-for-production-use";

import {
  BCRYPT_COST,
  PasswordTooLongError,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { generateSessionId, hashSessionId } from "@/lib/auth/session";
import {
  clearRateLimit,
  clientIpFrom,
  consumeRateLimit,
  resetRateLimit,
} from "@/lib/security/rate-limit";
import { encodeSessionToken, sessionCookieName } from "@/lib/auth/session-cookie";
import { decode } from "next-auth/jwt";
import { MAX_USER_AGENT_LENGTH, Session, User } from "@/models";
import { parseCredentials, signInSchema, signUpSchema } from "@/validators/auth";
import { VerifyHarness, jsonOf } from "./lib/verify-harness";

// @next/env is CommonJS; load it through createRequire so this ESM script reads
// exactly the same .env files the Next.js runtime does.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

/* -------------------------------------------------------------------------- */
/* 1. Passwords                                                                */
/* -------------------------------------------------------------------------- */

section("Password hashing", [
  {
    description: "verifies the password it hashed",
    test: async () => {
      const hash = await hashPassword("correct horse battery");
      return verifyPassword("correct horse battery", hash);
    },
  },
  {
    description: "rejects a wrong password",
    test: async () => {
      const hash = await hashPassword("correct horse battery");
      return !(await verifyPassword("wrong horse battery", hash));
    },
  },
  {
    description: "uses the configured bcrypt cost",
    test: async () => {
      const hash = await hashPassword("cost check");
      // bcrypt format: $2b$<cost>$...
      return hash.split("$")[2] === String(BCRYPT_COST).padStart(2, "0");
    },
  },
  {
    description: "produces a different salt for the same password",
    test: async () => {
      const [a, b] = await Promise.all([hashPassword("same input"), hashPassword("same input")]);
      return a !== b;
    },
  },
  {
    description: "refuses to hash a password over 72 characters",
    test: async () => {
      try {
        await hashPassword("a".repeat(73));
        return false;
      } catch (error) {
        return error instanceof PasswordTooLongError;
      }
    },
  },
]);

section("Credential failure is not an oracle", [
  {
    description: "an unknown account (null hash) never verifies",
    test: async () => !(await verifyPassword("any password", null)),
  },
  {
    description: "an undefined hash never verifies",
    test: async () => !(await verifyPassword("any password", undefined)),
  },
  {
    description: "still does bcrypt work for an unknown account",
    test: async () => {
      const hash = await hashPassword("timing baseline");

      const startedKnown = performance.now();
      await verifyPassword("timing baseline", hash);
      const knownMs = performance.now() - startedKnown;

      const startedUnknown = performance.now();
      await verifyPassword("timing baseline", null);
      const unknownMs = performance.now() - startedUnknown;

      // Both paths must run a comparison. A 10x gap would mean the unknown
      // account short-circuited and leaked its existence through timing.
      return unknownMs > knownMs / 10;
    },
  },
  {
    description: "a rejected over-length password never reaches bcrypt",
    test: async () => {
      try {
        await verifyPassword("b".repeat(73), "$2b$12$abcdefghijklmnopqrstuv");
        return false;
      } catch (error) {
        return error instanceof PasswordTooLongError;
      }
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Credential validation                                                    */
/* -------------------------------------------------------------------------- */

section("Credential validation", [
  {
    description: "accepts valid sign-in input",
    test: () =>
      signInSchema.safeParse({ email: "ayesha@example.com", password: "hunter2hunter2" }).success,
  },
  {
    description: "lowercases and trims the email",
    test: () => {
      const parsed = signInSchema.parse({
        email: "  Ayesha@Example.COM ",
        password: "hunter2hunter2",
      });
      return parsed.email === "ayesha@example.com";
    },
  },
  {
    description: "rejects a malformed email",
    test: () =>
      !signInSchema.safeParse({ email: "not-an-email", password: "hunter2hunter2" }).success,
  },
  {
    description: "rejects a short password at sign-up",
    test: () =>
      !signUpSchema.safeParse({
        name: "Ayesha Khan",
        email: "ayesha@example.com",
        password: "short",
        acceptTerms: true,
      }).success,
  },
  {
    description: "rejects sign-up without accepted terms",
    test: () =>
      !signUpSchema.safeParse({
        name: "Ayesha Khan",
        email: "ayesha@example.com",
        password: "longenoughpassword",
        acceptTerms: false,
      }).success,
  },
  {
    description: 'accepts the checkbox value "on" as accepted',
    test: () =>
      signUpSchema.safeParse({
        name: "Ayesha Khan",
        email: "ayesha@example.com",
        password: "longenoughpassword",
        acceptTerms: "on",
      }).success,
  },
  {
    description: "rejects a name shorter than 2 characters",
    test: () =>
      !signUpSchema.safeParse({
        name: "A",
        email: "ayesha@example.com",
        password: "longenoughpassword",
        acceptTerms: true,
      }).success,
  },
  {
    description: "parseCredentials returns field-keyed details",
    test: () => {
      const result = parseCredentials(signUpSchema, { name: "A", email: "nope", password: "x" });
      return (
        !result.success && result.details.name !== undefined && result.details.email !== undefined
      );
    },
  },
  {
    description: "parseCredentials returns typed data on success",
    test: () => {
      const result = parseCredentials(signInSchema, {
        email: "a@b.co",
        password: "hunter2hunter2",
      });
      return result.success && result.data.email === "a@b.co";
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Session identifiers                                                      */
/* -------------------------------------------------------------------------- */

section("Session identifiers", [
  {
    description: "are 256-bit, URL-safe and unpadded",
    test: () => {
      const id = generateSessionId();
      return id.length === 43 && /^[A-Za-z0-9_-]+$/.test(id);
    },
  },
  {
    description: "1000 generated ids are unique",
    test: () => {
      const ids = new Set(Array.from({ length: 1000 }, () => generateSessionId()));
      return ids.size === 1000;
    },
  },
  {
    description: "hash to a 64-character hex digest",
    test: () => /^[0-9a-f]{64}$/.test(hashSessionId(generateSessionId())),
  },
  {
    description: "hashing is deterministic",
    test: () => hashSessionId("fixed-input") === hashSessionId("fixed-input"),
  },
  {
    description: "the hash does not contain the id",
    test: () => {
      const id = generateSessionId();
      return !hashSessionId(id).includes(id);
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Brute-force limiter                                                      */
/* -------------------------------------------------------------------------- */

const LIMITER = "auth:verify";

section("Brute-force limiter", [
  {
    description: "allows attempts up to the limit",
    test: () => {
      clearRateLimit(LIMITER);
      const results = Array.from({ length: 5 }, () =>
        consumeRateLimit(LIMITER, "k1", { limit: 5, windowMs: 60_000 }),
      );
      return results.every((result) => result.allowed);
    },
  },
  {
    description: "blocks the attempt after the limit",
    test: () => {
      const result = consumeRateLimit(LIMITER, "k1", { limit: 5, windowMs: 60_000 });
      return !result.allowed && result.attempts === 6 && result.retryAfterMs > 0;
    },
  },
  {
    description: "counts each key separately",
    test: () => consumeRateLimit(LIMITER, "k2", { limit: 5, windowMs: 60_000 }).allowed,
  },
  {
    description: "reset frees the key again",
    test: () => {
      resetRateLimit(LIMITER, "k1");
      return consumeRateLimit(LIMITER, "k1", { limit: 5, windowMs: 60_000 }).allowed;
    },
  },
  {
    description: "keeps counting while the window is still open",
    test: () => {
      clearRateLimit(LIMITER);
      for (let index = 0; index < 3; index += 1) {
        consumeRateLimit(LIMITER, "k3", { limit: 3, windowMs: 60_000 });
      }
      return !consumeRateLimit(LIMITER, "k3", { limit: 3, windowMs: 60_000 }).allowed;
    },
  },
  {
    description: "an expired window starts a fresh count",
    test: async () => {
      clearRateLimit(LIMITER);
      for (let index = 0; index < 3; index += 1) {
        consumeRateLimit(LIMITER, "k4", { limit: 3, windowMs: 20 });
      }
      const blocked = consumeRateLimit(LIMITER, "k4", { limit: 3, windowMs: 20 });

      // Wait well past the window (3x) so the reset is not a race.
      await new Promise((resolve) => setTimeout(resolve, 60));

      const fresh = consumeRateLimit(LIMITER, "k4", { limit: 3, windowMs: 20 });
      return !blocked.allowed && fresh.allowed && fresh.attempts === 1;
    },
  },
  {
    description: "reads the first x-forwarded-for entry",
    test: () =>
      clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })) === "203.0.113.7",
  },
  {
    description: "falls back to x-real-ip, then to unknown",
    test: () =>
      clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" })) === "198.51.100.4" &&
      clientIpFrom(new Headers()) === "unknown",
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Session cookie                                                           */
/* -------------------------------------------------------------------------- */

section("Session cookie", [
  {
    description: "round-trips through the same primitive Auth.js uses to read it",
    test: async () => {
      const name = sessionCookieName();
      const token = await encodeSessionToken({
        sessionId: "opaque-session-id",
        userId: "507f1f77bcf86cd799439011",
        expiresAt: 1_800_000_000,
      });

      const decoded = await decode({ token, secret: process.env.AUTH_SECRET ?? "", salt: name });
      return (
        decoded?.sessionId === "opaque-session-id" && decoded?.id === "507f1f77bcf86cd799439011"
      );
    },
  },
  {
    description: "is an encrypted JWE that leaks neither the session id nor the user id",
    test: async () => {
      const token = await encodeSessionToken({
        sessionId: "opaque-session-id",
        userId: "507f1f77bcf86cd799439011",
        expiresAt: 1_800_000_000,
      });

      return (
        token.split(".").length === 5 &&
        !token.includes("opaque-session-id") &&
        !token.includes("507f1f77bcf86cd799439011")
      );
    },
  },
  {
    description: "is rejected when the cookie name (key salt) does not match",
    test: async () => {
      const token = await encodeSessionToken({
        sessionId: "opaque-session-id",
        userId: "507f1f77bcf86cd799439011",
        expiresAt: 1_800_000_000,
      });

      try {
        await decode({ token, secret: process.env.AUTH_SECRET ?? "", salt: "wrong-name" });
        return false;
      } catch {
        return true;
      }
    },
  },
  {
    description: "uses the __Host- prefix in production only",
    test: () =>
      process.env.NODE_ENV === "production"
        ? sessionCookieName() === "__Host-solvepilot.session"
        : sessionCookieName() === "solvepilot.session",
  },
]);

/* -------------------------------------------------------------------------- */
/* 6. Secret handling in serialization                                         */
/* -------------------------------------------------------------------------- */

section("Secrets never serialize", [
  {
    description: "user JSON strips passwordHash",
    test: () => {
      const json = jsonOf(
        new User({
          name: "Ayesha Khan",
          email: "ayesha@example.com",
          passwordHash: "$2b$12$secret",
        }),
      );
      return json.passwordHash === undefined && json.id !== undefined;
    },
  },
  {
    description: "passwordHash is never selected by default",
    test: () => User.schema.path("passwordHash")?.options.select === false,
  },
  {
    description: "session JSON strips _id",
    test: () => {
      const json = jsonOf(
        new Session({
          sessionHash: "a".repeat(64),
          userId: new User({ name: "A B", email: "a@b.co" }).id,
          expiresAt: new Date(),
        }),
      );
      return json._id === undefined && json.id !== undefined;
    },
  },
  {
    description: "the session user agent is length-capped",
    test: () => Session.schema.path("userAgent")?.options?.maxlength === MAX_USER_AGENT_LENGTH,
  },
]);

/* -------------------------------------------------------------------------- */
/* 7. Run the suite                                                            */
/* -------------------------------------------------------------------------- */

await harness.run();
