import {
  Archive,
  Building2,
  CircleAlert,
  FolderPlus,
  Paperclip,
  Pencil,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { issueStatusLabel } from "@/lib/constants/issues";
import { isIssueStatus } from "@/lib/issue-status";
import type { SafeActivityItem } from "@/services/activity.service";
import type { ActivityAction } from "@/types/domain";

export function getActivityIcon(action: ActivityAction) {
  switch (action) {
    case "issue.created":
      return <CircleAlert className="size-4 text-primary" aria-hidden="true" />;
    case "issue.updated":
    case "issue.status_changed":
      return <Pencil className="size-4 text-blue-500" aria-hidden="true" />;
    case "issue.attachment_added":
      return <Paperclip className="size-4 text-primary" aria-hidden="true" />;
    case "issue.attachment_deleted":
      return <Trash2 className="size-4 text-destructive" aria-hidden="true" />;
    case "project.created":
      return <FolderPlus className="size-4 text-primary" aria-hidden="true" />;
    case "project.updated":
      return <Pencil className="size-4 text-blue-500" aria-hidden="true" />;
    case "project.archived":
      return <Archive className="size-4 text-amber-500" aria-hidden="true" />;
    case "project.deleted":
      return <Trash2 className="size-4 text-destructive" aria-hidden="true" />;
    case "member.added":
    case "workspace.member_added":
      return <UserPlus className="size-4 text-emerald-500" aria-hidden="true" />;
    case "member.role_changed":
    case "workspace.member_role_changed":
      return <Shield className="size-4 text-indigo-500" aria-hidden="true" />;
    case "member.removed":
    case "workspace.member_removed":
      return <UserMinus className="size-4 text-destructive" aria-hidden="true" />;
    case "workspace.created":
      return <Building2 className="size-4 text-primary" aria-hidden="true" />;
    case "workspace.updated":
      return <Settings className="size-4 text-muted-foreground" aria-hidden="true" />;
    default:
      return <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />;
  }
}

export function ActivityMessage({ activity }: { activity: SafeActivityItem }) {
  const { action, actor, metadata } = activity;
  const actorName = actor.name || "A team member";

  switch (action) {
    case "issue.attachment_added":
    case "issue.attachment_deleted": {
      const fileName = typeof metadata.fileName === "string" ? metadata.fileName : "a file";
      const verb = action === "issue.attachment_added" ? "attached" : "removed";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> {verb}{" "}
          <strong className="font-medium text-foreground">&ldquo;{fileName}&rdquo;</strong>.
        </span>
      );
    }

    case "issue.status_changed": {
      const from = isIssueStatus(metadata.from) ? metadata.from : null;
      const to = isIssueStatus(metadata.to) ? metadata.to : null;
      const title = typeof metadata.title === "string" ? metadata.title : "this problem";
      if (!from || !to) {
        return (
          <span>
            <strong className="font-semibold text-foreground">{actorName}</strong> updated the
            Problem status
          </span>
        );
      }
      const titleNode = (
        <strong className="font-semibold text-foreground">&ldquo;{title}&rdquo;</strong>
      );
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong>{" "}
          {from === "resolved" && to === "in_progress" ? "reopened " : "moved "}
          {titleNode} from {issueStatusLabel(from)} to {issueStatusLabel(to)}.
        </span>
      );
    }

    case "issue.updated": {
      const changes = Array.isArray(metadata.changes)
        ? metadata.changes.filter(
            (change): change is { field: string; from?: string; to?: string } =>
              typeof change === "object" &&
              change !== null &&
              "field" in change &&
              typeof change.field === "string",
          )
        : [];
      const changedFields = Array.isArray(metadata.changedFields)
        ? metadata.changedFields.filter((field): field is string => typeof field === "string")
        : [];
      const labels: Record<string, string> = {
        title: "the title",
        description: "the description",
        category: "the category",
        priority: "priority",
        projectId: "the project",
      };
      const primary = changes[0];
      const label = primary
        ? (labels[primary.field] ?? "problem details")
        : (labels[changedFields[0] ?? ""] ?? "problem details");
      const format = (value: string | undefined) => {
        if (!value) return "No Project";
        return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      };
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> updated {label}
          {primary?.from !== undefined || primary?.to !== undefined ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {format(primary.from)} → {format(primary.to)}
            </span>
          ) : null}
          {changedFields.length > 1 ? (
            <span className="text-xs text-muted-foreground">
              {" "}
              and {changedFields.length - 1} other field{changedFields.length > 2 ? "s" : ""}
            </span>
          ) : null}
        </span>
      );
    }

    case "issue.created": {
      const issueTitle = (metadata.title as string) || "a problem";
      const issueId = activity.issueId ?? (metadata.issueId as string | undefined);

      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created problem{" "}
          {issueId ? (
            <Link
              href={`/dashboard/issues/${issueId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              &ldquo;{issueTitle}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">&ldquo;{issueTitle}&rdquo;</span>
          )}
        </span>
      );
    }

    case "project.created": {
      const projectName = (metadata.projectName as string) || "a project";
      const projectId = metadata.projectId as string | undefined;

      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created project{" "}
          {projectId ? (
            <Link
              href={`/dashboard/projects/${projectId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              &ldquo;{projectName}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">&ldquo;{projectName}&rdquo;</span>
          )}
        </span>
      );
    }

    case "project.updated": {
      const projectName = (metadata.projectName as string) || "a project";
      const projectId = metadata.projectId as string | undefined;

      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> updated project{" "}
          {projectId ? (
            <Link
              href={`/dashboard/projects/${projectId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              &ldquo;{projectName}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">&ldquo;{projectName}&rdquo;</span>
          )}
        </span>
      );
    }

    case "project.archived": {
      const projectName = (metadata.projectName as string) || "a project";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> archived project{" "}
          <span className="font-medium text-foreground">&ldquo;{projectName}&rdquo;</span>
        </span>
      );
    }

    case "project.deleted": {
      const projectName = (metadata.projectName as string) || "a project";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> deleted project{" "}
          <span className="font-medium text-foreground">&ldquo;{projectName}&rdquo;</span>
        </span>
      );
    }

    case "member.added":
    case "workspace.member_added": {
      const targetName =
        (metadata.targetName as string) || (metadata.targetEmail as string) || "a new member";
      const role = (metadata.role as string) || "member";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> added{" "}
          <strong className="font-semibold text-foreground">{targetName}</strong> as {role}
        </span>
      );
    }

    case "member.role_changed":
    case "workspace.member_role_changed": {
      const targetName = (metadata.targetName as string) || "a member";
      const newRole = (metadata.newRole as string) || "member";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> changed role for{" "}
          <strong className="font-semibold text-foreground">{targetName}</strong> to {newRole}
        </span>
      );
    }

    case "member.removed":
    case "workspace.member_removed": {
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> removed a member
          from the workspace
        </span>
      );
    }

    case "workspace.created": {
      const wsName = (metadata.workspaceName as string) || "the workspace";
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created the
          workspace{" "}
          <strong className="font-semibold text-foreground">&ldquo;{wsName}&rdquo;</strong>
        </span>
      );
    }

    case "workspace.updated": {
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> updated workspace
          settings
        </span>
      );
    }

    default:
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> performed an action
          ({action})
        </span>
      );
  }
}
