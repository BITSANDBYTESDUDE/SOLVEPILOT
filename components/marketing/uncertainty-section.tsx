import { AlertTriangle, Eye, Lightbulb, Microscope } from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KINDS = [
  {
    icon: Eye,
    label: "Observation",
    example: "The screenshot shows the navbar extending past the viewport edge at 375px.",
    tone: "text-info",
  },
  {
    icon: Microscope,
    label: "Inference",
    example: "The container width is likely fixed, which would cause this overflow.",
    tone: "text-primary",
  },
  {
    icon: Lightbulb,
    label: "Assumption",
    example: "Assuming the same layout is used across all marketing pages.",
    tone: "text-warning-foreground",
  },
  {
    icon: AlertTriangle,
    label: "Risk",
    example: "Changing the container may shift desktop spacing if the width is shared.",
    tone: "text-destructive",
  },
] as const;

export function UncertaintySection() {
  return (
    <Section
      eyebrow="AI honesty"
      title="AI that says what it knows — and what it does not"
      description="SolvePilot never presents speculation as certainty. Every statement is labelled by how it was derived, and confidence is tracked per claim."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {KINDS.map((kind) => (
          <Card key={kind.label} className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <kind.icon className={`size-4 ${kind.tone}`} aria-hidden="true" />
                {kind.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{kind.example}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Never
          </p>
          <p className="mt-3 text-sm font-medium">“Your server definitely has a memory leak.”</p>
        </div>
        <div className="rounded-xl border border-success/25 bg-success/5 p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Instead
          </p>
          <p className="mt-3 text-sm font-medium">
            “The available evidence suggests a possible memory-related issue. Further verification
            is recommended.”
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Verification can only report <span className="font-medium">passed</span>,{" "}
        <span className="font-medium">failed</span> or{" "}
        <span className="font-medium">needs review</span> based on the evidence actually attached to
        the problem.
      </p>
    </Section>
  );
}
