import { CheckSquare, Clock, Square } from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_PRIORITY_TONES,
} from "@/lib/constants/domain";

/** Worked example taken from the SolvePilot product brief. */
const EXAMPLE = {
  input: "My website navbar is going outside the screen on mobile.",
  title: "Mobile Navbar Overflow",
  category: "ui" as const,
  priority: "high" as const,
  summary: "Navigation content exceeds the mobile viewport.",
  confidence: 0.91,
  causes: [
    { title: "Fixed-width navigation container", confidence: 0.82 },
    { title: "Excessive horizontal padding", confidence: 0.64 },
    { title: "Missing mobile breakpoint", confidence: 0.71 },
  ],
  plan: [
    "Inspect the navbar container",
    "Check responsive breakpoints",
    "Remove the fixed width",
    "Implement the mobile navigation",
    "Test across multiple viewport sizes",
  ],
  tasks: [
    { label: "Inspect navbar container", done: true },
    { label: "Check responsive breakpoints", done: true },
    { label: "Fix mobile layout", done: true },
    { label: "Test at 320px", done: true },
    { label: "Test at 375px", done: false },
    { label: "Verify final result", done: false },
  ],
} as const;

export function ExampleWalkthrough() {
  return (
    <Section
      id="example"
      eyebrow="Worked example"
      title="What a real problem looks like in SolvePilot"
      description="A short, vague description goes in. A classified, diagnosed, planned and trackable problem comes out."
      className="border-y bg-muted/30"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Submitted problem
            </CardTitle>
            <p className="mt-2 border-l-2 border-l-primary/40 pl-3 text-sm text-muted-foreground italic">
              “{EXAMPLE.input}”
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">{EXAMPLE.title}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ISSUE_CATEGORY_LABELS[EXAMPLE.category]}</Badge>
                <Badge variant={ISSUE_PRIORITY_TONES[EXAMPLE.priority]}>
                  {ISSUE_PRIORITY_LABELS[EXAMPLE.priority]} priority
                </Badge>
                <Badge variant="info">Confidence {(EXAMPLE.confidence * 100).toFixed(0)}%</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{EXAMPLE.summary}</p>
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Possible causes</h3>
                <ol className="mt-3 space-y-3">
                  {EXAMPLE.causes.map((cause, index) => (
                    <li key={cause.title} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="font-medium">{cause.title}</span>
                      </div>
                      <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                        Confidence {(cause.confidence * 100).toFixed(0)}% — verify before acting.
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Recommended plan</h3>
                <ol className="mt-3 space-y-2">
                  {EXAMPLE.plan.map((step, index) => (
                    <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden="true" />
                  Estimated effort: 30–60 minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Generated tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {EXAMPLE.tasks.map((task) => (
                <li key={task.label} className="flex items-start gap-2.5 text-sm">
                  {task.done ? (
                    <CheckSquare
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className={task.done ? "text-muted-foreground line-through" : ""}>
                    {task.label}
                  </span>
                </li>
              ))}
            </ul>
            <Separator className="my-5" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Finish the remaining tasks, upload before/after evidence and SolvePilot runs the
              verification checks before the problem can be marked resolved.
            </p>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
