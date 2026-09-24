import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireUser } from "@/lib/auth/guards";

/**
 * Dashboard shell (Task 05).
 *
 * Authentication is enforced here once for the whole section, so individual
 * pages cannot forget their own guard. `requireUser()` fails closed when the
 * session store is unavailable and redirects to `/login` otherwise.
 *
 * Every page under `/dashboard` is therefore protected by construction.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/dashboard");

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
            <span className="hidden max-w-44 truncate text-sm text-muted-foreground sm:inline">
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
