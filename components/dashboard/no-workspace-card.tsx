import { Building2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown when the signed-in user belongs to no workspace.
 *
 * Every workspace-scoped dashboard page needs this state, so it lives here
 * instead of being re-written per page.
 */
export function NoWorkspaceState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Workspace Found</CardTitle>
          <CardDescription>
            You need to belong to a workspace before working on problems.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <Building2 className="size-12 text-muted-foreground/60" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Create your first workspace or switch to an active workspace in settings.
          </p>
          <Button asChild>
            <Link href="/dashboard/settings#workspaces">Go to Workspace Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
