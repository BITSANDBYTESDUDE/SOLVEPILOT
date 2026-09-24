import "server-only";

import mongoose, { type Types } from "mongoose";

import {
  INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_MAX_ATTEMPTS,
  SIGN_IN_WINDOW_MS,
  SIGN_UP_MAX_ATTEMPTS,
  SIGN_UP_WINDOW_MS,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, type SessionInfo } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";
import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, RateLimitError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clientIpFrom, consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { signInSchema, signUpSchema } from "@/validators/auth";
import { User, type UserDocument } from "@/models";

const log = logger.child("auth:service");

/** A `users` document as read back from the driver: the id is always present. */
type StoredUser = UserDocument & { _id: Types.ObjectId };

const SIGN_IN_LIMITER = "auth:signin";
const SIGN_UP_LIMITER = "auth:signup";

export interface CredentialRequestContext {
  /** Used for the session record and for brute-force keying. */
  request?: Request;
}

export interface SignInResult {
  user: SessionUser;
  session: SessionInfo;
}

/**
 * Credential authentication (Task 04).
 *
 * Failure handling is deliberately uniform:
 *  - an unknown email and a wrong password raise the same error with the same
 *    message, so the endpoint cannot be used to enumerate accounts,
 *  - `verifyPassword` runs a bcrypt comparison even for an unknown email, so
 *    response *timing* does not leak that either,
 *  - repeated failures are throttled per email and per IP.
 */
export async function signInWithCredentials(
  credentials: unknown,
  context: CredentialRequestContext = {},
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(credentials);
  if (!parsed.success) {
    throw new ValidationError(INVALID_CREDENTIALS_MESSAGE);
  }

  const { email, password } = parsed.data;
  const ip = context.request ? clientIpFrom(context.request.headers) : "unknown";

  assertWithinLimit(SIGN_IN_LIMITER, `email:${email}`, {
    limit: SIGN_IN_MAX_ATTEMPTS,
    windowMs: SIGN_IN_WINDOW_MS,
  });
  assertWithinLimit(SIGN_IN_LIMITER, `ip:${ip}`, {
    limit: SIGN_IN_MAX_ATTEMPTS * 4,
    windowMs: SIGN_IN_WINDOW_MS,
  });

  await connectToDatabase();

  // `passwordHash` is `select: false` on the schema — it must be asked for.
  const user = await User.findOne({ email }).select("+passwordHash").lean<StoredUser | null>();
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    log.warn("sign-in rejected", { email, ip });
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  resetRateLimit(SIGN_IN_LIMITER, `email:${email}`);
  resetRateLimit(SIGN_IN_LIMITER, `ip:${ip}`);

  const session = await createSession(user._id, context.request);
  log.info("sign-in succeeded", { userId: String(user._id) });

  return { user: toSessionUser(user), session };
}

export interface SignUpResult {
  user: SessionUser;
  session: SessionInfo;
}

/**
 * Account creation (Task 04).
 *
 * Registration is throttled per IP and email uniqueness is enforced by the
 * database index — the pre-check exists only to produce a friendly message,
 * because the unique index is what actually prevents a duplicate under a race.
 */
export async function signUp(
  input: unknown,
  context: CredentialRequestContext = {},
): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "Invalid request data.");
  }

  const { name, email, password } = parsed.data;
  const ip = context.request ? clientIpFrom(context.request.headers) : "unknown";

  assertWithinLimit(SIGN_UP_LIMITER, `ip:${ip}`, {
    limit: SIGN_UP_MAX_ATTEMPTS,
    windowMs: SIGN_UP_WINDOW_MS,
  });

  await connectToDatabase();

  const existing = await User.findOne({ email }).select({ _id: 1 }).lean();
  if (existing) {
    throw new ConflictError("An account with this email already exists.");
  }

  let created: StoredUser;
  try {
    created = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      // Role is never taken from input — every new account starts as "user".
      role: "user",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("An account with this email already exists.");
    }
    throw error;
  }

  resetRateLimit(SIGN_UP_LIMITER, `ip:${ip}`);

  const session = await createSession(created._id, context.request);
  log.info("account created", { userId: String(created._id) });

  return { user: toSessionUser(created), session };
}

function assertWithinLimit(
  limiter: string,
  key: string,
  options: { limit: number; windowMs: number },
): void {
  const result = consumeRateLimit(limiter, key, options);
  if (!result.allowed) {
    log.warn("rate limit reached", { limiter, key, attempts: result.attempts });
    throw new RateLimitError(TOO_MANY_ATTEMPTS_MESSAGE);
  }
}

/** MongoDB unique-index violation (E11000). */
function isDuplicateKeyError(error: unknown): boolean {
  if (error instanceof mongoose.Error.ValidationError) return false;
  const code = (error as { code?: unknown } | null)?.code;
  return code === 11000;
}

function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    createdAt: user.createdAt,
  };
}
