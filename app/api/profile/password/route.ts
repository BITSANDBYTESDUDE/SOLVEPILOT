import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { changePassword } from "@/services/profile.service";

export const dynamic = "force-dynamic";

/**
 * `POST /api/profile/password` — change the account password.
 *
 * Requires the current password, so a session left open on a shared machine
 * cannot be used to take the account over. Every other session is revoked; the
 * one making the change stays signed in.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, session } = await requireApiUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const result = await changePassword(user.id, body, { keepSessionHash: session.sessionId });

    return jsonOk({
      passwordChanged: true,
      revokedSessions: result.revokedSessions,
    });
  } catch (error) {
    return jsonError(error, { route: "POST /api/profile/password" });
  }
}
