import { CheckCircle2, Database, LayoutDashboard, Users, XCircle } from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CHATBOT_LIMITS = [
  "Answers get buried in a long conversation",
  "No classification, ownership or priority",
  "No tasks, evidence or verification trail",
  "Nothing to hand to a client or manager",
] as const;

const SOLVEPILOT_PROPERTIES = [
  "Every problem is a first-class, addressable record",
  "AI output is validated and stored as structured data",
  "Tasks, evidence and verification stay linked to the problem",
  "One report you can share through a secure link",
] as const;

const PILLARS = [
  {
    icon: LayoutDashboard,
    title: "A workspace, not a thread",
    description:
      "Issues, projects, tasks and evidence live in a navigable workspace with status, priority and ownership.",
  },
  {
    icon: Database,
    title: "Structured records",
    description:
      "Classification, diagnosis and plans are persisted as typed records — searchable, filterable and reportable.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description:
      "Workspaces, members and role-based permissions (owner, admin, member) enforced on the server.",
  },
] as const;

export function ProductPillars() {
  return (
    <Section
      id="workspace"
      eyebrow="Product"
      title="A structured workspace beats an endless chat"
      description="SolvePilot keeps the whole resolution lifecycle — so progress is visible, measurable and provable."
      className="border-y bg-muted/30"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {PILLARS.map((pillar) => (
          <Card key={pillar.title} className="shadow-xs">
            <CardHeader>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <pillar.icon className="size-4" aria-hidden="true" />
              </span>
              <CardTitle className="mt-2">{pillar.title}</CardTitle>
              <CardDescription>{pillar.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-destructive/20 shadow-xs">
          <CardHeader>
            <CardTitle className="text-muted-foreground">A generic chatbot</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {CHATBOT_LIMITS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-success/25 shadow-xs">
          <CardHeader>
            <CardTitle>SolvePilot</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {SOLVEPILOT_PROPERTIES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
