import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { listWorkspacesForUser } from "@/services/workspace.service";

/**
 * Dashboard shell (Task 05 layout, Task 06 workspace context).
 *
 * Authentication is enforced here once for the whole section, so individual
 * pages cannot forget their own guard. `requireUser()` fails closed when the
 * session store is unavailable and redirects to `/login` otherwise.
 *
 * The workspace list is resolved from membership, never from the cookie: the
 * cookie only says which of the caller's workspaces is selected.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/dashboard");

  const [workspaces, activeWorkspaceId] = await Promise.all([
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" aria-label="SolvePilot dashboard" className="shrink-0">
              <Logo />
            </Link>
            <DashboardNav />
          </div>

          <div className="flex items-center gap-3">
            <WorkspaceSwitcher
              workspaces={workspaces.map((workspace) => ({
                id: workspace.id,
                name: workspace.name,
                role: workspace.role,
              }))}
              activeWorkspaceId={activeWorkspaceId}
            />
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="container-page flex-1 py-8">
        {children}
      </main>
    </div>
  );
}
