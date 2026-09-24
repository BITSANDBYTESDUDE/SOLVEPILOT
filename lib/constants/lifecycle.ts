/**
 * The SolvePilot resolution lifecycle.
 *
 * Every problem moves through the same ten stages. The stages power the
 * marketing pipeline, the issue progress rail and the AI orchestration order.
 */
export interface LifecycleStage {
  id: LifecycleStageId;
  label: string;
  description: string;
}

export const LIFECYCLE_STAGE_IDS = [
  "problem",
  "understand",
  "classify",
  "diagnose",
  "plan",
  "act",
  "evidence",
  "verify",
  "resolve",
  "report",
] as const;

export type LifecycleStageId = (typeof LIFECYCLE_STAGE_IDS)[number];

export const LIFECYCLE_STAGES: readonly LifecycleStage[] = [
  {
    id: "problem",
    label: "Problem",
    description: "Capture the problem as text, screenshot, PDF or voice note.",
  },
  {
    id: "understand",
    label: "Understand",
    description: "Extract the usable signal from every input that was provided.",
  },
  {
    id: "classify",
    label: "Classify",
    description: "Category, priority, a precise title and a confidence score.",
  },
  {
    id: "diagnose",
    label: "Diagnose",
    description: "Possible causes, observations, risks and explicit assumptions.",
  },
  {
    id: "plan",
    label: "Plan",
    description: "An ordered solution plan with an honest effort estimate.",
  },
  {
    id: "act",
    label: "Act",
    description: "Tasks generated from the plan, tracked to completion.",
  },
  {
    id: "evidence",
    label: "Collect evidence",
    description: "Before, after and supporting evidence, attached to the problem.",
  },
  {
    id: "verify",
    label: "Verify",
    description: "Structured checks run against the original problem statement.",
  },
  {
    id: "resolve",
    label: "Resolve",
    description: "Close the loop with a resolution summary that states the limits.",
  },
  {
    id: "report",
    label: "Report",
    description: "A professional PDF report, shareable through a secure link.",
  },
];
