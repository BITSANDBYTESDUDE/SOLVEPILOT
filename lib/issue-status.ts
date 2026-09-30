import { ISSUE_STATUSES, type IssueStatus } from "@/types/domain";

/** The single authoritative Problem lifecycle transition map. */
export const ISSUE_STATUS_TRANSITIONS = {
  new: ["analyzing"],
  analyzing: ["planned", "new"],
  planned: ["in_progress", "analyzing"],
  in_progress: ["verification", "planned"],
  verification: ["resolved", "in_progress"],
  resolved: ["closed", "in_progress"],
  closed: ["resolved"],
} as const satisfies Record<IssueStatus, readonly IssueStatus[]>;

export interface IssueStatusTransition {
  from: IssueStatus;
  to: IssueStatus;
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === "string" && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function canTransitionIssueStatus(
  currentStatus: IssueStatus,
  nextStatus: IssueStatus,
): boolean {
  return (ISSUE_STATUS_TRANSITIONS[currentStatus] as readonly IssueStatus[]).includes(nextStatus);
}

export function getAvailableIssueStatusTransitions(status: IssueStatus): readonly IssueStatus[] {
  return ISSUE_STATUS_TRANSITIONS[status];
}
