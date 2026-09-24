import "server-only";

import bcrypt from "bcryptjs";

import { PASSWORD_MAX_LENGTH } from "@/lib/auth/constants";

/**
 * Password hashing (Task 04).
 *
 * Rules enforced in one place:
 *  - bcrypt cost 12 — slow enough to make offline cracking expensive, fast
 *    enough to stay invisible during a sign-in (~250ms),
 *  - over-length passwords are rejected instead of silently truncated at
 *    bcrypt's 72-byte boundary,
 *  - verification always runs a hash comparison, even when the account does
 *    not exist, so response timing does not reveal which emails are registered.
 */

export const BCRYPT_COST = 12;

export class PasswordTooLongError extends Error {
  constructor() {
    super(`Passwords must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
    this.name = "PasswordTooLongError";
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordLength(password);
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Constant-work comparison.
 *
 * Pass a placeholder hash when no account was found so an attacker cannot
 * distinguish "unknown email" from "wrong password" by measuring latency.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  assertPasswordLength(password);

  const target = passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, target);

  // A dummy comparison can never authenticate.
  return passwordHash ? matches : false;
}

function assertPasswordLength(password: string): void {
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordTooLongError();
  }
}

/**
 * Pre-computed bcrypt hash of a random string, used to keep the work done for
 * an unknown email identical to the work done for a known one.
 */
const DUMMY_HASH = bcrypt.hashSync("solvepilot-timing-equalizer", BCRYPT_COST);
