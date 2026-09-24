import { clearSessionCookie, readSessionToken } from "@/lib/auth/session-cookie";
import { revokeSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { jsonError, jsonOk } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

const log = logger.child("auth:signout");

/**
 * `POST /api/auth/signout` — end the current session.
 *
 * Two things happen, and both are needed:
 *  - the session document is deleted, so the session is revoked server-side
 *    rather than merely forgotten by this browser,
 *  - the cookie is expired in the response.
 *
 * Clearing the cookie alone would not be enough: a captured cookie would stay
 * valid until its expiry.
 */
export async function POST() {
  try {
    const token = await readSessionToken();
    let revoked = false;

    if (token) {
      revoked = await revokeSession(token.sessionId);
      log.info("sign-out", { revoked, userId: token.userId });
    }

    return clearSessionCookie(jsonOk({ signedOut: true, revoked }));
  } catch (error) {
    return jsonError(error, { route: "POST /api/auth/signout" });
  }
}
