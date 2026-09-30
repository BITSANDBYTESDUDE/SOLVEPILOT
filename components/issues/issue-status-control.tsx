"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IssueStatusBadge } from "@/components/issues/issue-badges";
import { canTransitionIssueStatus, getAvailableIssueStatusTransitions } from "@/lib/issue-status";
import type { IssueStatus } from "@/types/domain";

type StatusResponse = {
  success?: boolean;
  data?: { issue?: { status?: IssueStatus } };
  error?: { message?: string };
};

function transitionActionLabel(from: IssueStatus, to: IssueStatus): string {
  if (to === "analyzing") return "Start Analysis";
  if (to === "planned") return "Mark Planned";
  if (to === "new") return "Return to New";
  if (to === "in_progress") {
    return from === "resolved" || from === "closed" ? "Reopen Problem" : "Return to In Progress";
  }
  if (to === "verification") return "Send to Verification";
  if (to === "resolved") return "Mark Resolved";
  return "Close Problem";
}

export function IssueStatusControl({
  workspaceId,
  issueId,
  issueTitle,
  initialStatus,
  canChangeStatus,
}: {
  workspaceId: string;
  issueId: string;
  issueTitle: string;
  initialStatus: IssueStatus;
  canChangeStatus: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const transitions = getAvailableIssueStatusTransitions(status);

  const changeStatus = async (nextStatus: IssueStatus) => {
    if (pending || !canTransitionIssueStatus(status, nextStatus)) return;

    if (nextStatus === "resolved") {
      const confirmed = window.confirm(
        `Resolve Problem?\n\nAre you sure “${issueTitle}” has been successfully resolved?`,
      );
      if (!confirmed) return;
    }
    if (nextStatus === "closed") {
      const confirmed = window.confirm(
        `Close Problem?\n\n“${issueTitle}” can be reopened later if needed.`,
      );
      if (!confirmed) return;
    }

    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as StatusResponse;
      if (!response.ok || !payload.data?.issue?.status) {
        setError(
          response.status === 403
            ? "You don't have permission to change this problem's status."
            : response.status === 400
              ? (payload.error?.message ?? "This status transition is not allowed.")
              : "Unable to update the problem status. Please try again.",
        );
        router.refresh();
        return;
      }

      setStatus(payload.data.issue.status);
      setMessage("Problem status updated.");
      router.refresh();
    } catch {
      setError("Unable to update the problem status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card aria-busy={pending}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <IssueStatusBadge status={status} />
        </div>

        {canChangeStatus && transitions.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Available status transitions">
            {transitions.map((nextStatus) => (
              <Button
                key={nextStatus}
                type="button"
                variant={nextStatus === "resolved" ? "default" : "outline"}
                onClick={() => changeStatus(nextStatus)}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : status === "resolved" && nextStatus === "in_progress" ? (
                  <RefreshCw aria-hidden="true" />
                ) : null}
                {pending ? "Updating…" : transitionActionLabel(status, nextStatus)}
              </Button>
            ))}
          </div>
        ) : null}

        {message ? (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Status was not changed.</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
