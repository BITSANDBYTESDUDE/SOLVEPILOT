import { FileLock2, KeyRound, ShieldCheck, UserCheck } from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTROLS = [
  {
    icon: UserCheck,
    title: "Server-enforced authorization",
    description:
      "Authentication, workspace membership and role checks run on the server for every request. Client-side checks are never trusted.",
  },
  {
    icon: KeyRound,
    title: "Workspace isolation",
    description:
      "Every query is scoped to the workspaces you belong to, which blocks IDOR-style access to other tenants' records.",
  },
  {
    icon: FileLock2,
    title: "Hardened uploads",
    description:
      "MIME type and size validation, content checks where practical, and object storage instead of database blobs.",
  },
  {
    icon: ShieldCheck,
    title: "Safe by default",
    description:
      "Zod validation on all external input, AI output validated before it is stored, secrets kept server-side only.",
  },
] as const;

export function SecuritySection() {
  return (
    <Section
      id="security"
      eyebrow="Security"
      title="Built for problems you would not paste into a public chatbot"
      description="Workspace data, uploads and AI keys are handled with the assumption that everything from the client is hostile until validated."
      className="border-y bg-muted/30"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTROLS.map((control) => (
          <Card key={control.title} className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <control.icon className="size-4 text-primary" aria-hidden="true" />
                {control.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{control.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
