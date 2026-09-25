"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Calendar,
  Clock,
  Pencil,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  ArchiveProjectDialog,
  DeleteProjectDialog,
  EditProjectDialog,
} from "@/components/project/project-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ProjectDetail, ProjectSummary } from "@/services/project.service";
import type { WorkspaceRole } from "@/types/domain";

export interface ProjectDetailViewProps {
  workspaceId: string;
  project: ProjectDetail;
  currentUserRole: WorkspaceRole;
}

export function ProjectDetailView({
  workspaceId,
  project,
  currentUserRole,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = React.useState<ProjectDetail>(project);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <div className="flex flex-col gap-6">
      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Projects
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant={currentProject.status === "active" ? "default" : "secondary"}>
            {currentProject.status === "active" ? "Active" : "Archived"}
          </Badge>

          {canManage ? (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </Button>

              <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
                {currentProject.status === "active" ? (
                  <>
                    <Archive className="size-3.5" aria-hidden="true" />
                    Archive
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="size-3.5" aria-hidden="true" />
                    Restore
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Project Overview Card */}
      <Card style={{ borderLeftColor: currentProject.color, borderLeftWidth: 6 }}>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">{currentProject.name}</CardTitle>
              <CardDescription className="mt-2 text-sm leading-relaxed text-foreground/80">
                {currentProject.description || "No description provided for this project."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Created By</p>
                <p className="font-medium text-foreground">
                  {currentProject.creatorName || "Workspace Member"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Created</p>
                <p className="font-medium text-foreground">
                  {formatDate(currentProject.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Last Updated</p>
                <p className="font-medium text-foreground">
                  {formatDateTime(currentProject.updatedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div
                className="size-4 shrink-0 rounded-full border"
                style={{ backgroundColor: currentProject.color }}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Color Theme</p>
                <p className="font-mono text-xs font-medium text-foreground">
                  {currentProject.color}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problems Placeholder Card (Scope Rule: Do NOT implement Issues) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Problems & Issues</CardTitle>
          <CardDescription>
            Problems, investigations, and AI-guided resolution workflows linked to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold">
              No problems have been added to this project yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Problems and AI-powered workflows will appear here once issue management is activated
              in the next phase.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editOpen ? (
        <EditProjectDialog
          workspaceId={workspaceId}
          project={currentProject}
          onClose={() => setEditOpen(false)}
          onSuccess={(updated: ProjectSummary) => {
            setCurrentProject((prev) => ({
              ...prev,
              name: updated.name,
              description: updated.description,
              color: updated.color,
              status: updated.status,
              updatedAt: updated.updatedAt,
            }));
            setFeedback({ type: "success", message: `Project "${updated.name}" updated.` });
            setEditOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* Archive Dialog */}
      {archiveOpen ? (
        <ArchiveProjectDialog
          workspaceId={workspaceId}
          project={currentProject}
          onClose={() => setArchiveOpen(false)}
          onSuccess={(updated: ProjectSummary) => {
            setCurrentProject((prev) => ({
              ...prev,
              status: updated.status,
              updatedAt: updated.updatedAt,
            }));
            setFeedback({
              type: "success",
              message:
                updated.status === "archived"
                  ? `Project "${updated.name}" archived.`
                  : `Project "${updated.name}" restored.`,
            });
            setArchiveOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* Delete Dialog */}
      {deleteOpen ? (
        <DeleteProjectDialog
          workspaceId={workspaceId}
          project={currentProject}
          onClose={() => setDeleteOpen(false)}
          onSuccess={() => {
            router.push("/dashboard/projects");
          }}
        />
      ) : null}
    </div>
  );
}
