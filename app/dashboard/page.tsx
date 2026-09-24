import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * A protected page must never be prerendered: a static shell would be produced
 * at build time, when there is no session to check, and then served to
 * everyone. Rendering on demand is what makes `requireUser()` authoritative.
 */
export const dynamic = "force-dynamic";

/**
 * Dashboard shell (Task 04).
 *
 * Authentication is real: `requireUser()` redirects to `/login` when there is
 * no valid session, and the identity shown here is read from the database on
 * this request — not decoded from the cookie.
 *
 * The statistics and activity feed below it still belong to Tasks 05–10.
 */
export default async function DashboardPage() {
  const { user, session } = await requireUser("/dashboard");

  return (
    <main id="main" className="container-page flex min-h-dvh flex-col gap-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user.email} · session expires{" "}
            {session.expiresAt.toUTCString().replace(" GMT", " UTC")}
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Everything SolvePilot currently knows about you. Preferences arrive with Task 05.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={user.name} />
          <Detail label="Email" value={user.email} />
          <Detail label="User id" value={user.id} mono />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Role
            </span>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What comes next</CardTitle>
          <CardDescription>
            Authentication is live. The workspace shell, statistics and activity feed are
            implemented by Tasks 05 to 10.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>Task 05 — user profile and preferences</li>
            <li>Task 06 — workspace creation (your first workspace is created there)</li>
            <li>Task 09 — dashboard statistics</li>
            <li>Task 10 — activity logging</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</span>
    </div>
  );
}
