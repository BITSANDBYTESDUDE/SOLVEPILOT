import type {
  EvidenceType,
  InputType,
  IssueCategory,
  IssuePriority,
  IssueSource,
  IssueStatus,
  ProjectStatus,
  ReportStatus,
  TaskPriority,
  TaskStatus,
  VerificationCheckResult,
  VerificationMethod,
  VerificationStatus,
  WorkspaceRole,
} from "@/types/domain";

/**
 * Display vocabulary for domain enums.
 *
 * Keeping labels and colour tones here (instead of inside components) means a
 * status is rendered identically in lists, boards, reports and PDFs.
 */
export type StatusTone =
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info" | "muted";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  analyzing: "Analyzing",
  planned: "Planned",
  in_progress: "In progress",
  verification: "Verification",
  resolved: "Resolved",
  closed: "Closed",
};

export const ISSUE_STATUS_TONES: Record<IssueStatus, StatusTone> = {
  new: "outline",
  analyzing: "info",
  planned: "secondary",
  in_progress: "default",
  verification: "warning",
  resolved: "success",
  closed: "muted",
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ISSUE_PRIORITY_TONES: Record<IssuePriority, StatusTone> = {
  low: "muted",
  medium: "secondary",
  high: "warning",
  critical: "destructive",
};

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  technical: "Technical",
  ui: "UI / UX",
  business: "Business",
  productivity: "Productivity",
  academic: "Academic",
  other: "Other",
};

export const ISSUE_SOURCE_LABELS: Record<IssueSource, string> = {
  text: "Text",
  image: "Screenshot",
  pdf: "PDF",
  voice: "Voice",
  mixed: "Mixed",
};

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  text: "Text",
  image: "Image",
  pdf: "PDF",
  audio: "Audio",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
};

export const TASK_STATUS_TONES: Record<TaskStatus, StatusTone> = {
  todo: "outline",
  in_progress: "info",
  completed: "success",
  skipped: "muted",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  before: "Before",
  after: "After",
  supporting: "Supporting",
};

export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  manual: "Manual review",
  ai: "AI verification",
  combined: "AI + manual review",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  needs_review: "Needs review",
};

export const VERIFICATION_STATUS_TONES: Record<VerificationStatus, StatusTone> = {
  passed: "success",
  failed: "destructive",
  needs_review: "warning",
};

export const VERIFICATION_CHECK_RESULT_LABELS: Record<VerificationCheckResult, string> = {
  pass: "Pass",
  fail: "Fail",
  unknown: "Unknown",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};
