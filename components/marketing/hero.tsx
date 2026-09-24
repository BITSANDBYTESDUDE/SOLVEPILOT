import { ArrowRight, Route, ShieldCheck, Waypoints } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LIFECYCLE_STAGES } from "@/lib/constants/lifecycle";

const HIGHLIGHTS = [
  {
    icon: Route,
    title: "Structured lifecycle",
    description: "Ten explicit stages from problem intake to verified resolution report.",
  },
  {
    icon: Waypoints,
    title: "Grounded AI",
    description:
      "Observations, inferences and assumptions are labelled — never presented as certainty.",
  },
  {
    icon: ShieldCheck,
    title: "Verification first",
    description: "A problem is only marked resolved when the evidence supports it.",
  },
] as const;

export function Hero() {
  const problemStage = LIFECYCLE_STAGES[0];
  const reportStage = LIFECYCLE_STAGES[LIFECYCLE_STAGES.length - 1];

  return (
    <section className="relative overflow-hidden border-b">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-40"
      />
      <div className="relative container-page py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            AI-powered problem resolution workspace
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Your AI Guide from <span className="text-primary">Problem</span> to Solution
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            SolvePilot is not another chat window. Submit a problem by text, screenshot, PDF or
            voice — and move through classification, diagnosis, planning, tasks, evidence,
            verification and a shareable resolution report.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Start resolving problems
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in to your workspace</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            {problemStage?.label} → {reportStage?.label} · Every stage tracked, every decision
            logged.
          </p>
        </div>

        <dl className="mt-14 grid gap-6 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-5 shadow-xs">
              <dt className="flex items-center gap-2 text-sm font-semibold">
                <item.icon className="size-4 text-primary" aria-hidden="true" />
                {item.title}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
