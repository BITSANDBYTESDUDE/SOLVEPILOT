import { getDatabaseStatus, pingDatabase } from "@/lib/db/connect";
import { jsonOk } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe.
 *
 * Deliberately minimal: it reports whether the database is configured and
 * reachable, but never leaks host names, database names or error details.
 */
export async function GET() {
  const status = getDatabaseStatus();
  const reachable = status.configured ? await pingDatabase() : false;

  return jsonOk({
    status: reachable || !status.configured ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      configured: status.configured,
      reachable,
    },
    timestamp: new Date().toISOString(),
  });
}
