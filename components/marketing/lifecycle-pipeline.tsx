import {
  BadgeCheck,
  BrainCircuit,
  ClipboardList,
  FileDown,
  Flag,
  FolderSearch,
  ListChecks,
  MessageSquarePlus,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Section } from "@/components/marketing/section";
import { LIFECYCLE_STAGES, type LifecycleStageId } from "@/lib/constants/lifecycle";

const STAGE_ICONS: Record<LifecycleStageId, typeof Flag> = {
  problem: MessageSquarePlus,
  understand: Search,
  classify: FolderSearch,
  diagnose: BrainCircuit,
  plan: ClipboardList,
  act: ListChecks,
  evidence: Flag,
  verify: ShieldCheck,
  resolve: BadgeCheck,
  report: FileDown,
};

export function LifecyclePipeline() {
  return (
    <Section
      id="lifecycle"
      eyebrow="The lifecycle"
      title="One pipeline, from raw problem to verified report"
      description="Each stage produces structured output that feeds the next. Nothing is skipped, and every artefact stays attached to the problem."
    >
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LIFECYCLE_STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.id];
          return (
            <li
              key={stage.id}
              className="group relative rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">{stage.label}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {stage.description}
              </p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
