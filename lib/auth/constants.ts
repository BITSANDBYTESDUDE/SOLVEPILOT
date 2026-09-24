/**
 * Authentication constants (Task 04).
 *
 * Deliberately dependency-free so both server modules and validators can share
 * the same limits without importing `server-only` code.
 */

/** Session lifetime. Long enough to be useful, short enough to expire. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Idle timeout. A session that is not used for this long is treated as
 * abandoned even if it has not reached its absolute expiry.
 */
export const SESSION_IDLE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Maximum concurrent sessions kept per user before the oldest are pruned. */
export const MAX_SESSIONS_PER_USER = 10;

/* -------------------------------------------------------------------------- */
/* Credential limits                                                           */
/* -------------------------------------------------------------------------- */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt only considers the first 72 bytes of its input; silently truncating a
 * longer password would be a lie to the user, so it is rejected instead.
 */
export const PASSWORD_MAX_LENGTH = 72;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/** RFC 5321 address limit; matches the `users` schema. */
export const EMAIL_MAX_LENGTH = 254;

/* -------------------------------------------------------------------------- */
/* Brute-force protection                                                      */
/* -------------------------------------------------------------------------- */

/** Failed sign-in attempts allowed per identity inside the window. */
export const SIGN_IN_MAX_ATTEMPTS = 5;

/** Sliding window in milliseconds for the counter above. */
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

/** Registration attempts allowed per IP inside the window. */
export const SIGN_UP_MAX_ATTEMPTS = 10;

export const SIGN_UP_WINDOW_MS = 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Single message for every credential failure.
 *
 * Revealing whether the email exists turns the sign-in form into an account
 * enumeration oracle, so both cases answer identically.
 */
export const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";

export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

export const AUTH_NOT_CONFIGURED_MESSAGE =
  "Authentication is unavailable: set MONGODB_URI to enable it.";
