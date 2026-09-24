import { Schema, Types, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";

/**
 * Server-side session store (Task 04).
 *
 * Auth.js signs the cookie, but the session of record lives here: the cookie
 * carries an opaque, unguessable `id`, and only its SHA-256 hash is persisted.
 * Every authenticated request re-validates that hash against this collection,
 * which is what makes a session *revocable* — signing out, a password change
 * or an admin action can end a session immediately instead of waiting for a
 * token to expire.
 *
 * The raw id is never stored, so a database leak cannot be replayed as a
 * session.
 */
export interface SessionDocument {
  /** SHA-256 hex digest of the opaque session id held by the client. */
  sessionHash: string;
  userId: Types.ObjectId;
  /** ISO user agent, truncated; shown as "Chrome on macOS" in a device list. */
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  /** Absolute creation time — sessions are never silently extended forever. */
  createdAt: Date;
  updatedAt: Date;
}

/** Truncate user agents so a hostile client cannot store megabytes per login. */
export const MAX_USER_AGENT_LENGTH = 256;

const sessionSchema = new Schema<SessionDocument>(
  {
    sessionHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userAgent: { type: String, trim: true, maxlength: MAX_USER_AGENT_LENGTH, default: null },
    ipAddress: { type: String, trim: true, maxlength: 64, default: null },
    expiresAt: { type: Date, required: true },
  },
  baseSchemaOptions,
);

// Uniqueness is declared only here (a `unique: true` path option would create a
// second, identical index).
sessionSchema.index({ sessionHash: 1 }, { unique: true, name: "session_hash_unique" });
sessionSchema.index({ userId: 1, createdAt: -1 }, { name: "user_id_created_at_desc" });
// Drives the expiry sweep: "delete everything already past its expiry".
sessionSchema.index({ expiresAt: 1 }, { name: "expires_at_asc" });

export const Session: Model<SessionDocument> = registeredModel<SessionDocument>(
  "Session",
  sessionSchema,
  "sessions",
);
