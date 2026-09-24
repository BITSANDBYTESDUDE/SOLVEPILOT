import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { updatePreferences } from "@/services/profile.service";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/profile/preferences` — update theme and/or email notifications.
 *
 * Partial by design: sending only `theme` must not reset `emailNotifications`.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireApiUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = Object.fromEntries(await request.formData());
    }

    const { preferences } = await updatePreferences(user.id, body);
    return jsonOk({ preferences });
  } catch (error) {
    return jsonError(error, { route: "PATCH /api/profile/preferences" });
  }
}
