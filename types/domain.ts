/**
 * Domain vocabulary for SolvePilot.
 *
 * These literals are the single source of truth shared by Mongoose models,
 * Zod validators, services and UI. Collection-level documents are added with
 * their models in the database phase.
 */

/* -------------------------------------------------------------------------- */
/* Users & workspaces                                                          */
/* -------------------------------------------------------------------------- */

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const GLOBAL_ROLES = ["user", "admin"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/* -------------------------------------------------------------------------- */
/* Projects & issues                                                           */
/* -------------------------------------------------------------------------- */

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ISSUE_CATEGORIES = [
  "technical",
  "ui",
  "business",
  "productivity",
  "academic",
  "other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/**
 * Issue lifecycle: new -> analyzing -> planned -> in_progress -> verification
 * -> resolved -> closed.
 */
export const ISSUE_STATUSES = [
  "new",
  "analyzing",
  "planned",
  "in_progress",
  "verification",
  "resolved",
  "closed",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_SOURCES = ["text", "image", "pdf", "voice", "mixed"] as const;
export type IssueSource = (typeof ISSUE_SOURCES)[number];

/* -------------------------------------------------------------------------- */
/* Inputs, evidence, reports                                                   */
/* -------------------------------------------------------------------------- */

export const INPUT_TYPES = ["text", "image", "pdf", "audio"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const PROCESSING_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const EVIDENCE_TYPES = ["before", "after", "supporting"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const REPORT_STATUSES = ["generating", "ready", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

export const TASK_STATUSES = ["todo", "in_progress", "completed", "skipped"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/* -------------------------------------------------------------------------- */
/* Verification                                                                */
/* -------------------------------------------------------------------------- */

export const VERIFICATION_METHODS = ["manual", "ai", "combined"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_STATUSES = ["passed", "failed", "needs_review"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_CHECK_RESULTS = ["pass", "fail", "unknown"] as const;
export type VerificationCheckResult = (typeof VERIFICATION_CHECK_RESULTS)[number];

export interface VerificationCheck {
  name: string;
  result: VerificationCheckResult;
  explanation: string;
}

/* -------------------------------------------------------------------------- */
/* AI                                                                          */
/* -------------------------------------------------------------------------- */

export const AI_RUN_TYPES = [
  "classification",
  "diagnosis",
  "planning",
  "task_generation",
  "verification",
  "report",
] as const;
export type AiRunType = (typeof AI_RUN_TYPES)[number];

export const AI_RUN_STATUSES = ["succeeded", "failed"] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

export const AI_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type AiConfidenceLevel = (typeof AI_CONFIDENCE_LEVELS)[number];

export interface PossibleCause {
  title: string;
  explanation: string;
  /** 0–1. Must never be presented to users as certainty. */
  confidence: number;
}

export interface SolutionStep {
  order: number;
  title: string;
  description: string;
}

/** How an AI statement is grounded — drives the uncertainty UX. */
export const EVIDENCE_KINDS = ["observation", "inference", "assumption", "recommendation"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Activity & notifications                                                    */
/* -------------------------------------------------------------------------- */

export interface ActivityMetadata {
  [key: string]: unknown;
}

/**
 * Audited actions. Stored as strings (with schema-level enum validation) so the
 * activity feed stays filterable without a lookup table.
 */
export const ACTIVITY_ACTIONS = [
  "workspace.created",
  "workspace.member_added",
  "workspace.member_removed",
  "workspace.member_role_changed",
  "project.created",
  "project.updated",
  "project.archived",
  "issue.created",
  "issue.updated",
  "issue.status_changed",
  "issue.analyzed",
  "issue.assigned",
  "issue.resolved",
  "input.uploaded",
  "diagnosis.generated",
  "plan.generated",
  "task.created",
  "task.updated",
  "task.assigned",
  "task.completed",
  "task.reopened",
  "task.skipped",
  "evidence.uploaded",
  "evidence.deleted",
  "verification.started",
  "verification.completed",
  "report.generated",
  "report.shared",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  "issue_assigned",
  "task_assigned",
  "task_completed",
  "verification_completed",
  "report_generated",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
