import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface BuildStageNoticeProps {
  title: string;
  /** The development task that will replace this notice with the real module. */
  plannedTask: string;
  description: string;
}

/**
 * Honest placeholder for routes whose module has not been implemented yet.
 *
 * SolvePilot is built task-by-task (see README → Build progress). Until a
 * module lands, its route renders this notice instead of pretending to work,
 * so navigation never dead-ends and progress stays visible.
 */
export function BuildStageNotice({ title, plannedTask, description }: BuildStageNoticeProps) {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <Logo />
      <Badge variant="muted" className="mt-8">
        <Construction aria-hidden="true" />
        {plannedTask}
      </Badge>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft />
            Back to landing page
          </Link>
        </Button>
      </div>
    </main>
  );
}
