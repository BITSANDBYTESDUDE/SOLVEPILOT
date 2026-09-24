import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="container-page py-16 sm:py-20">
      <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-12 text-center shadow-xs sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-30"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Stop losing problems in chat history
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Create a workspace, capture your first problem and walk it through to a verified,
            shareable resolution report.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Create your workspace
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
