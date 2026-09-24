"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * Deliberately shows a generic message plus the digest (which correlates with
 * the server-side log entry) — internal error details are never rendered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaced in the browser console for developers; server logs hold the detail.
    console.error("[solvepilot] unhandled application error", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page could not be loaded. Your data has not been changed. You can retry, and if the
        problem continues, share the reference below with support.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}
