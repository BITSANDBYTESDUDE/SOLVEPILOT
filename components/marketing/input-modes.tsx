import {
  AudioLines,
  FileText,
  Image as ImageIcon,
  Layers,
  LockKeyhole,
  Type,
  Upload,
} from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INPUT_MODES = [
  {
    icon: Type,
    title: "Text",
    description: "Describe the problem in your own words. The primary path and always available.",
    status: "Available",
  },
  {
    icon: ImageIcon,
    title: "Screenshot",
    description:
      "Attach a screenshot or photo. Visual context sharpens classification and diagnosis.",
    status: "Available",
  },
  {
    icon: FileText,
    title: "PDF",
    description: "Upload specs, error logs or reports. Text is extracted and used as evidence.",
    status: "Available",
  },
  {
    icon: AudioLines,
    title: "Voice",
    description: "Record a voice note when typing is slower than explaining out loud.",
    status: "Available",
  },
] as const;

const UPLOAD_GUARANTEES = [
  "MIME type and file size validated on the server",
  "Stored in S3-compatible object storage, never in the database",
  "Access controlled per workspace with signed, expiring URLs",
  "Upload progress, validation feedback and removable items",
] as const;

export function InputModes() {
  return (
    <Section
      id="inputs"
      eyebrow="Problem intake"
      title="Bring the problem in whatever shape you have it"
      description="Most real problems arrive as a mix of a short description, a screenshot and a log file. SolvePilot handles all of it."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INPUT_MODES.map((mode) => (
          <Card key={mode.title} className="shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <mode.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-success">{mode.status}</span>
              </div>
              <CardTitle className="mt-2">{mode.title}</CardTitle>
              <CardDescription>{mode.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-5 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
            Uploads are treated as untrusted input
          </CardTitle>
          <CardDescription>
            Every file passes server-side validation before it reaches storage or the AI layer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {UPLOAD_GUARANTEES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Upload className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Layers className="size-3.5" aria-hidden="true" />
        Multiple inputs on the same problem are combined and marked as a mixed source.
      </p>
    </Section>
  );
}
