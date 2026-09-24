import { type NextRequest } from "next/server";

import { encodeSessionToken, setSessionCookie } from "@/lib/auth/session-cookie";
import { jsonCreated, jsonError } from "@/lib/http/api-response";
import { signUp } from "@/services/auth.service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/auth/register` — create an account and sign straight in.
 *
 * Registration signs the user in immediately so there is no dead end between
 * "account created" and the dashboard. The role always defaults to `user`;
 * nothing from the request body can escalate it.
 */
export async function POST(request: NextRequest) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = await request.formData().catch(() => null);
    }

    const { user, session } = await signUp(payload, { request });
    const token = await encodeSessionToken({
      sessionId: session.id,
      userId: user.id,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
    });

    const response = jsonCreated({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return setSessionCookie(response, token, session.expiresAt);
  } catch (error) {
    return jsonError(error, { route: "POST /api/auth/register" });
  }
}
