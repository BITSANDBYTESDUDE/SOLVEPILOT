import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { getProfile, updateProfile } from "@/services/profile.service";

export const dynamic = "force-dynamic";

/**
 * `GET /api/profile` — the signed-in user's own profile.
 *
 * `PATCH /api/profile` — update name and/or avatar URL.
 *
 * The user id comes from the session, never from the request, so there is no
 * parameter an attacker could change to reach another account (IDOR).
 */
export async function GET() {
  try {
    const { user } = await requireApiUser();
    return jsonOk({ profile: await getProfile(user.id) });
  } catch (error) {
    return jsonError(error, { route: "GET /api/profile" });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireApiUser();
    const body = await readBody(request);
    return jsonOk({ profile: await updateProfile(user.id, body) });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/profile" });
  }
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // A form post is accepted as well, so a non-JS client is not locked out.
    return Object.fromEntries(await request.formData());
  }
}
