import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

/**
 * `GET /api/auth/session` — the signed-in user, or a 401.
 *
 * Unlike Auth.js's own `/api/auth/session` (which echoes the token payload),
 * this reads the user from the database, so it reflects a deleted account or a
 * changed role immediately.
 */
export async function GET() {
  try {
    const { user } = await requireApiUser();

    return jsonOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error, { route: "GET /api/auth/session" });
  }
}
