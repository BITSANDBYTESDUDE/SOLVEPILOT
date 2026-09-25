import {
  Archive,
  Building2,
  FolderPlus,
  Pencil,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { SafeActivityItem } from "@/services/activity.service";
import type { ActivityAction } from "@/types/domain";

export function getActivityIcon(action: ActivityAction) {
  switch (action) {
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
