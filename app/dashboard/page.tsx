import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";

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
 * Dashboard overview (Task 04 shell, Task 05 account summary).
 *
 * Statistics, recent problems and the activity feed belong to Tasks 09 and 10;
 * this page deliberately does not fake them.
 */
export default async function DashboardPage() {
  const { user, session } = await requireUser("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in since {formatDateTime(session.createdAt)} · session expires{" "}
          {formatDateTime(session.expiresAt)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your profile, appearance and password are managed in settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={user.name} />
          <Detail label="Email" value={user.email} />
          <div className="flex flex-col gap-1">
            <Label>Role</Label>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings">
                <Settings aria-hidden="true" />
                Manage settings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What comes next</CardTitle>
          <CardDescription>
            The workspace shell, statistics and activity feed are implemented by the tasks below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>Task 06 — workspace creation (your first workspace is created there)</li>
            <li>Task 08 — projects</li>
            <li>Task 09 — dashboard statistics</li>
            <li>Task 10 — activity logging</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <span className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</span>
    </div>
  );
}
