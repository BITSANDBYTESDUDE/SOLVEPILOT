import "server-only";

import { cookies } from "next/headers";

/**
 * Active workspace selection (Task 06).
 *
 * The cookie holds only a workspace id and is **not** an authorization
 * credential: every read re-resolves membership against the `workspaces`
 * collection, so editing the cookie by hand can at worst select a workspace the
 * user already belongs to — never one they do not.
 *
 * It is deliberately not `httpOnly` so the switcher can update it without a
 * round trip, but nothing security-relevant is derived from it client-side.
 */

export const ACTIVE_WORKSPACE_COOKIE = "solvepilot.workspace";

export async function getActiveWorkspaceId(): Promise<string | null> {
  const value = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

/** Attach the selection cookie to an outgoing response. */
export function setActiveWorkspaceCookie(response: Response, workspaceId: string): Response {
  response.headers.append(
    "set-cookie",
    `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
  return response;
}
