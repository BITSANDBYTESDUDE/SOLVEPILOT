import { type NextRequest } from "next/server";

import { encodeSessionToken, setSessionCookie } from "@/lib/auth/session-cookie";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { signInWithCredentials } from "@/services/auth.service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/auth/login` — exchange credentials for a session.
 *
 * Own endpoint rather than Auth.js's `/api/auth/callback/credentials` so the
 * response is the canonical `{ success, data | error }` envelope: validation
 * failures come back as field details, throttling as a 429, and bad
 * credentials as a single 401 with an enumeration-proof message.
 *
 * On success the session document already exists (`signInWithCredentials`
 * created it) and its opaque id is written into the encrypted cookie.
 */
export async function POST(request: NextRequest) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = await request.formData().catch(() => null);
    }

    const { user, session } = await signInWithCredentials(payload, { request });
    const token = await encodeSessionToken({
      sessionId: session.id,
      userId: user.id,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
    });

    const response = jsonOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return setSessionCookie(response, token, session.expiresAt);
  } catch (error) {
    return jsonError(error, { route: "POST /api/auth/login" });
  }
}
