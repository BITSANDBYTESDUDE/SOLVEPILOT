/**
 * Model registry.
 *
 * Importing this barrel guarantees every schema is compiled and registered —
 * used by services, scripts and the index-sync tooling.
 */
export { ActivityLog, type ActivityLogDocument } from "@/models/activity-log.model";
export { AiRun, type AiRunDocument } from "@/models/ai-run.model";
export {
  Diagnosis,
  type DiagnosisDocument,
  type PossibleCauseDocument,
} from "@/models/diagnosis.model";
export { Evidence, type EvidenceDocument } from "@/models/evidence.model";
export { Issue, type IssueDocument } from "@/models/issue.model";
export { IssueInput, type IssueInputDocument } from "@/models/issue-input.model";
export { Notification, type NotificationDocument } from "@/models/notification.model";
export { Project, type ProjectDocument } from "@/models/project.model";
export { Report, type ReportDocument } from "@/models/report.model";
export { MAX_USER_AGENT_LENGTH, Session, type SessionDocument } from "@/models/session.model";
export {
  SolutionPlan,
  type SolutionPlanDocument,
  type SolutionStepDocument,
} from "@/models/solution-plan.model";
export { Task, type TaskDocument } from "@/models/task.model";
export { User, type UserDocument, type UserPreferences } from "@/models/user.model";
export {
  Verification,
  type VerificationCheckDocument,
  type VerificationDocument,
} from "@/models/verification.model";
export { Workspace, type WorkspaceDocument, type WorkspaceMember } from "@/models/workspace.model";

export { baseSchemaOptions, registeredModel, transformDocument } from "@/models/schema-options";
