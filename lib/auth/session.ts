import "server-only";

import { createHash } from "node:crypto";

import { Types } from "mongoose";

import {
  MAX_SESSIONS_PER_USER,
  SESSION_IDLE_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import { connectToDatabase } from "@/lib/db/connect";
import { logger } from "@/lib/logger";
import { Session, MAX_USER_AGENT_LENGTH } from "@/models/session.model";
import { clientIpFrom } from "@/lib/security/rate-limit";

const log = logger.child("auth:session");

/**
 * Session service (Task 04).
 *
 * The client holds an opaque 256-bit random id. Only its SHA-256 hash is
 * persisted, and every authenticated request looks that hash up here — so a
 * session can be revoked at any moment (sign out, password change, admin
 * action) instead of living until a token expires.
 *
 * Lifetime rules:
 *  - absolute cap: `SESSION_MAX_AGE_SECONDS` from creation, never extended,
 *  - idle timeout: `expiresAt` slides forward on use, so an abandoned session
 *    dies on its own,
 *  - a user keeps at most `MAX_SESSIONS_PER_USER` sessions; the oldest are
 *    pruned when a new device signs in.
 */

export interface SessionInfo {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface ActiveSession {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

/** Do not rewrite `expiresAt` more often than this — keeps writes off the hot path. */
const EXTENSION_GRANULARITY_MS = 60 * 60 * 1000;

/**
 * Generate a session id.
 *
 * 32 random bytes rendered as URL-safe base64 without padding — unguessable
 * (256 bits of entropy) and safe inside a cookie value.
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 hex digest — the only form of the id that ever reaches the database. */
export function hashSessionId(id: string): string {
  return createHash("sha256").update(id, "utf8").digest("hex");
}

/** Create a session document for a freshly authenticated user. */
export async function createSession(
  userId: Types.ObjectId | string,
  request?: Request,
): Promise<SessionInfo> {
  await connectToDatabase();

  const id = generateSessionId();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_IDLE_MAX_AGE_SECONDS * 1000);

  await pruneForUser(userId);

  await Session.create({
    sessionHash: hashSessionId(id),
    userId: new Types.ObjectId(String(userId)),
    userAgent: request ? truncateUserAgent(request.headers.get("user-agent")) : null,
    ipAddress: request ? clientIpFrom(request.headers) : null,
    expiresAt,
  });

  log.info("session created", { userId: String(userId) });

  return { id, userId: String(userId), expiresAt };
}

/**
 * Resolve a session id to a live session, or `null` when it is unknown,
 * expired or revoked. Expired rows are removed as they are encountered, so the
 * collection cleans itself up during normal traffic.
 */
export async function getSession(id: string | null | undefined): Promise<ActiveSession | null> {
  if (!id) return null;

  await connectToDatabase();

  const sessionHash = hashSessionId(id);
  const document = await Session.findOne({ sessionHash }).lean();

  if (!document) return null;

  const now = new Date();

  if (document.expiresAt <= now) {
    await Session.deleteOne({ _id: document._id });
    return null;
  }

  // Absolute cap: `createdAt` never moves, so this cannot be extended forever.
  const absoluteExpiry = document.createdAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000;
  if (now.getTime() >= absoluteExpiry) {
    await Session.deleteOne({ _id: document._id });
    return null;
  }

  await maybeExtend(document._id, document.expiresAt);

  return {
    id: String(document._id),
    userId: String(document.userId),
    sessionId: sessionHash,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    userAgent: document.userAgent ?? null,
    ipAddress: document.ipAddress ?? null,
  };
}

/** Slide the idle expiry forward, at most once per hour per session. */
async function maybeExtend(sessionObjectId: Types.ObjectId, currentExpiry: Date): Promise<void> {
  const target = new Date(Date.now() + SESSION_IDLE_MAX_AGE_SECONDS * 1000);
  if (target.getTime() - currentExpiry.getTime() < EXTENSION_GRANULARITY_MS) return;

  try {
    await Session.updateOne({ _id: sessionObjectId }, { $set: { expiresAt: target } });
  } catch (error) {
    // A failed extension must never sign the user out.
    log.warn("could not extend session expiry", { error });
  }
}

/** End one session (sign out on this device). */
export async function revokeSession(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;

  await connectToDatabase();
  const result = await Session.deleteOne({ sessionHash: hashSessionId(id) });
  return result.deletedCount > 0;
}

/**
 * End every session except one — used after a password change, so a stolen
 * cookie dies while the person who just changed the password stays signed in.
 *
 * `keepSessionHash` is the stored SHA-256 hash, i.e. the `sessionId` returned
 * by `getSession()`, never a raw id.
 */
export async function revokeOtherSessionsForUser(
  userId: Types.ObjectId | string,
  keepSessionHash?: string,
): Promise<number> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(String(userId)) };
  if (keepSessionHash) filter.sessionHash = { $ne: keepSessionHash };

  const result = await Session.deleteMany(filter);
  log.info("other sessions revoked", { userId: String(userId), count: result.deletedCount });
  return result.deletedCount;
}

/** End every session for a user — used when an account is locked or deleted. */
export async function revokeAllSessionsForUser(userId: Types.ObjectId | string): Promise<number> {
  await connectToDatabase();
  const result = await Session.deleteMany({ userId: new Types.ObjectId(String(userId)) });
  log.info("all sessions revoked", { userId: String(userId), count: result.deletedCount });
  return result.deletedCount;
}

/** Drop sessions past their expiry. Safe to call on a schedule or at sign-in. */
export async function pruneExpiredSessions(): Promise<number> {
  await connectToDatabase();
  const result = await Session.deleteMany({ expiresAt: { $lte: new Date() } });
  return result.deletedCount;
}

/** Keep the per-user session count bounded by removing the oldest sessions. */
async function pruneForUser(userId: Types.ObjectId | string): Promise<void> {
  const objectId = new Types.ObjectId(String(userId));
  const surplus = await Session.find({ userId: objectId })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS_PER_USER - 1)
    .select({ _id: 1 })
    .lean();

  if (surplus.length === 0) return;

  await Session.deleteMany({ _id: { $in: surplus.map((entry) => entry._id) } });
  log.info("pruned surplus sessions", { userId: String(userId), count: surplus.length });
}

/** Sessions for the signed-in user, newest first — the "your devices" list. */
export async function listSessionsForUser(
  userId: Types.ObjectId | string,
): Promise<ActiveSession[]> {
  await connectToDatabase();

  const documents = await Session.find({
    userId: new Types.ObjectId(String(userId)),
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  return documents.map((document) => ({
    id: String(document._id),
    userId: String(document.userId),
    sessionId: document.sessionHash,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    userAgent: document.userAgent ?? null,
    ipAddress: document.ipAddress ?? null,
  }));
}

function truncateUserAgent(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}
