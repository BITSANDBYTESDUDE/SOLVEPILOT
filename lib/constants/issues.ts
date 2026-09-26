import type { IssueCategory, IssuePriority, IssueSource, IssueStatus } from "@/types/domain";

/**
 * Problem (issue) vocabulary and rules (Task 11).
 *
 * Client-safe on purpose: the create form and the server validators read the
 * same limits and the same messages from here, so the browser can never show a
 * rule the server does not enforce. The database stores the internal enum values
 * from `types/domain`; the labels below are for display only.
 */

/* -------------------------------------------------------------------------- */
/* Field limits                                                                */
/* -------------------------------------------------------------------------- */

export const ISSUE_TITLE_MIN_LENGTH = 3;
export const ISSUE_TITLE_MAX_LENGTH = 200;
export const ISSUE_DESCRIPTION_MIN_LENGTH = 10;
export const ISSUE_DESCRIPTION_MAX_LENGTH = 10_000;

/** Applied when the user does not choose explicitly. */
export const DEFAULT_ISSUE_CATEGORY: IssueCategory = "other";
export const DEFAULT_ISSUE_PRIORITY: IssuePriority = "medium";
/** Text is the only capture mode implemented in Task 11. */
export const ISSUE_CREATION_SOURCE: IssueSource = "text";

export const ISSUE_TITLE_MESSAGES = {
  required: "Title is required.",
  tooShort: `Title must be at least ${ISSUE_TITLE_MIN_LENGTH} characters.`,
  tooLong: `Title must be ${ISSUE_TITLE_MAX_LENGTH} characters or fewer.`,
} as const;

export const ISSUE_DESCRIPTION_MESSAGES = {
  required: "Description is required.",
  tooShort: `Description must be at least ${ISSUE_DESCRIPTION_MIN_LENGTH} characters.`,
  tooLong: `Description must be ${ISSUE_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
} as const;

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export interface IssueCategoryOption {
  value: IssueCategory;
  label: string;
  hint: string;
}

export const ISSUE_CATEGORY_OPTIONS: readonly IssueCategoryOption[] = [
  { value: "technical", label: "Technical", hint: "Bugs, errors, code and infrastructure" },
  { value: "ui", label: "UI / Design", hint: "Layout, styling and usability" },
  { value: "business", label: "Business", hint: "Process, cost and strategy" },
  { value: "productivity", label: "Productivity", hint: "Workflow and time management" },
  { value: "academic", label: "Academic", hint: "Study, research and coursework" },
  { value: "other", label: "Other", hint: "Anything that does not fit above" },
];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = Object.fromEntries(
  ISSUE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<IssueCategory, string>;

export interface IssuePriorityOption {
  value: IssuePriority;
  label: string;
  hint: string;
}

export const ISSUE_PRIORITY_OPTIONS: readonly IssuePriorityOption[] = [
  { value: "low", label: "Low", hint: "Handle when there is room" },
  { value: "medium", label: "Medium", hint: "Normal queue" },
  { value: "high", label: "High", hint: "Handle soon" },
  { value: "critical", label: "Critical", hint: "Blocking — handle now" },
];

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = Object.fromEntries(
  ISSUE_PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<IssuePriority, string>;

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  analyzing: "Analyzing",
  planned: "Planned",
  in_progress: "In progress",
  verification: "Verification",
  resolved: "Resolved",
  closed: "Closed",
};

export const ISSUE_SOURCE_LABELS: Record<IssueSource, string> = {
  text: "Text",
  image: "Image",
  pdf: "PDF",
  voice: "Voice",
  mixed: "Mixed",
};

export function issueCategoryLabel(value: IssueCategory): string {
  return ISSUE_CATEGORY_LABELS[value] ?? "Other";
}

export function issuePriorityLabel(value: IssuePriority): string {
  return ISSUE_PRIORITY_LABELS[value] ?? "Medium";
}

export function issueStatusLabel(value: IssueStatus): string {
  return ISSUE_STATUS_LABELS[value] ?? value;
}

export function issueSourceLabel(value: IssueSource): string {
  return ISSUE_SOURCE_LABELS[value] ?? "Text";
}

/* -------------------------------------------------------------------------- */
/* Draft validation (same rules as `validators/issue.ts`)                      */
/* -------------------------------------------------------------------------- */

export interface IssueDraft {
  title: string;
  description: string;
}

export type IssueDraftErrors = Partial<Record<keyof IssueDraft, string>>;

/**
 * Check a draft before it is sent, so the user sees the reason immediately.
 *
 * The server re-validates everything — this only shortens the feedback loop.
 */
export function issueDraftErrors(draft: IssueDraft): IssueDraftErrors {
  const errors: IssueDraftErrors = {};

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = ISSUE_TITLE_MESSAGES.required;
  } else if (title.length < ISSUE_TITLE_MIN_LENGTH) {
    errors.title = ISSUE_TITLE_MESSAGES.tooShort;
  } else if (title.length > ISSUE_TITLE_MAX_LENGTH) {
    errors.title = ISSUE_TITLE_MESSAGES.tooLong;
  }

  const description = draft.description.trim();
  if (description.length === 0) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.required;
  } else if (description.length < ISSUE_DESCRIPTION_MIN_LENGTH) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.tooShort;
  } else if (description.length > ISSUE_DESCRIPTION_MAX_LENGTH) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.tooLong;
  }

  return errors;
}

export function isIssueDraftValid(draft: IssueDraft): boolean {
  return Object.keys(issueDraftErrors(draft)).length === 0;
}
