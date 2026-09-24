import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/**
 * Centred shell shared by every authentication screen (login, register,
 * password reset). Keeps credential pages visually separate from the
 * dashboard workspace shell.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-14 items-center justify-between">
        <Link href="/" aria-label="SolvePilot home">
          <Logo />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to home
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="container-page py-6 text-center text-xs text-muted-foreground">
        Understand. Solve. Verify.
      </footer>
    </div>
  );
}
