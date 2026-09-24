import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <Logo />
      <div className="mt-8 flex size-11 items-center justify-center rounded-xl border bg-muted">
        <Compass className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page you are looking for does not exist, or you no longer have access to it. Check the
        address, or head back to your workspace.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to landing page</Link>
        </Button>
      </div>
    </main>
  );
}
