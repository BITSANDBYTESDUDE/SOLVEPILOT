import { requireApiUser } from "@/lib/auth/guards";
import { listSessionsForUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

/**
 * `GET /api/auth/sessions` — the signed-in user's active sessions.
 *
 * Backs the "where you are signed in" list. Only hashes are stored, so this
 * can never return anything replayable — just metadata and expiry.
 */
export async function GET() {
  try {
    const { user, session } = await requireApiUser();
    const sessions = await listSessionsForUser(user.id);

    return jsonOk({
      sessions: sessions.map((entry) => ({
        id: entry.id,
        userAgent: entry.userAgent,
        ipAddress: entry.ipAddress,
        createdAt: entry.createdAt.toISOString(),
        expiresAt: entry.expiresAt.toISOString(),
        current: entry.sessionId === session.sessionId,
      })),
    });
  } catch (error) {
    return jsonError(error, { route: "GET /api/auth/sessions" });
  }
}
