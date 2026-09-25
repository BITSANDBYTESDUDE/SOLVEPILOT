"use client";

import {
  Archive,
  ArchiveRestore,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { ProjectSummary } from "@/services/project.service";
import type { WorkspaceRole } from "@/types/domain";

export const COLOR_PRESETS = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Sky", value: "#0284c7" },
  { label: "Emerald", value: "#16a34a" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#dc2626" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Teal", value: "#0d9488" },
  { label: "Slate", value: "#64748b" },
];

export interface ProjectListProps {
  workspaceId: string;
  workspaceName: string;
  currentUserRole: WorkspaceRole;
  initialProjects: ProjectSummary[];
}

export function ProjectList({
  workspaceId,
  workspaceName,
  currentUserRole,
  initialProjects,
}: ProjectListProps) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectSummary[]>(initialProjects);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "archived">("all");
  const [sortOption, setSortOption] = React.useState<
    "recent" | "oldest" | "name-asc" | "name-desc" | "updated"
  >("recent");

  // Synchronize when initialProjects prop updates
  const [prevInitial, setPrevInitial] = React.useState(initialProjects);
  if (prevInitial !== initialProjects) {
    setPrevInitial(initialProjects);
    setProjects(initialProjects);
  }

  // Dialog states
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<ProjectSummary | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectSummary | null>(null);

  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // Filter & Search & Sort
  const filteredProjects = React.useMemo(() => {
    return projects
      .filter((project) => {
        if (statusFilter !== "all" && project.status !== statusFilter) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const nameMatch = project.name.toLowerCase().includes(q);
          const descMatch = (project.description || "").toLowerCase().includes(q);
          return nameMatch || descMatch;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "recent")
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortOption === "oldest")
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortOption === "name-asc") return a.name.localeCompare(b.name);
        if (sortOption === "name-desc") return b.name.localeCompare(a.name);
        if (sortOption === "updated")
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return 0;
      });
  }, [projects, search, statusFilter, sortOption]);

  return (
    <div className="flex flex-col gap-6">
      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage projects and workflows for{" "}
            <strong className="font-medium text-foreground">{workspaceName}</strong>.
          </p>
        </div>

        {canManage ? (
          <Button onClick={() => setCreateOpen(true)} className="self-start sm:self-auto">
            <Plus className="size-4" aria-hidden="true" />
            New Project
          </Button>
        ) : null}
      </div>

      {/* Controls: Search, Filter Tabs, Sort */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filters */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
            {(["all", "active", "archived"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <option value="recent">Recently Created</option>
            <option value="updated">Recently Updated</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {/* Projects Grid / Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <FolderKanban className="size-10 text-muted-foreground/60" aria-hidden="true" />
              <div>
                <h3 className="text-base font-medium">No projects yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first project to organize your problems and workflows.
                </p>
              </div>
              {canManage ? (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-2">
                  <Plus className="size-4" aria-hidden="true" />
                  Create Project
                </Button>
              ) : null}
            </div>
          ) : statusFilter === "archived" && !search ? (
            <div className="flex flex-col items-center gap-2">
              <Archive className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <h3 className="text-base font-medium">No archived projects</h3>
              <p className="text-sm text-muted-foreground">
                Projects you archive will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Search className="size-8 text-muted-foreground/60" aria-hidden="true" />
              <h3 className="text-base font-medium">No projects found</h3>
              <p className="text-sm text-muted-foreground">
                Try a different search term or change your status filter.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="group relative flex flex-col justify-between transition-shadow hover:shadow-sm"
              style={{ borderTopColor: project.color, borderTopWidth: 4 }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="inline-block truncate text-base font-semibold hover:underline"
                    >
                      {project.name}
                    </Link>
                  </div>
                  <Badge variant={project.status === "active" ? "default" : "secondary"}>
                    {project.status === "active" ? "Active" : "Archived"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 min-h-[2.5rem] text-xs">
                  {project.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    {formatDate(project.createdAt)}
                  </span>
                  {project.creatorName ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5" aria-hidden="true" />
                      {project.creatorName}
                    </span>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex items-center justify-end gap-1.5 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFeedback(null);
                        setEditTarget(project);
                      }}
                      title="Edit project"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFeedback(null);
                        setArchiveTarget(project);
                      }}
                      title={project.status === "active" ? "Archive project" : "Restore project"}
                    >
                      {project.status === "active" ? (
                        <Archive className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {project.status === "active" ? "Archive" : "Restore"}
                      </span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setFeedback(null);
                        setDeleteTarget(project);
                      }}
                      title="Delete project"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen ? (
        <CreateProjectDialog
          workspaceId={workspaceId}
          onClose={() => setCreateOpen(false)}
          onSuccess={(newProject) => {
            setProjects((prev) => [newProject, ...prev]);
            setFeedback({ type: "success", message: `Project "${newProject.name}" created.` });
            setCreateOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* Edit Dialog */}
      {editTarget ? (
        <EditProjectDialog
          workspaceId={workspaceId}
          project={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setFeedback({ type: "success", message: `Project "${updated.name}" updated.` });
            setEditTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      {/* Archive / Restore Dialog */}
      {archiveTarget ? (
        <ArchiveProjectDialog
          workspaceId={workspaceId}
          project={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onSuccess={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setFeedback({
              type: "success",
              message:
                updated.status === "archived"
                  ? `Project "${updated.name}" archived.`
                  : `Project "${updated.name}" restored to active.`,
            });
            setArchiveTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      {/* Delete Dialog */}
      {deleteTarget ? (
        <DeleteProjectDialog
          workspaceId={workspaceId}
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setFeedback({ type: "success", message: `Project "${deleteTarget.name}" deleted.` });
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Create Project Dialog                                                      */
/* -------------------------------------------------------------------------- */

interface CreateProjectDialogProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (project: ProjectSummary) => void;
}

function CreateProjectDialog({ workspaceId, onClose, onSuccess }: CreateProjectDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#4f46e5");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { project: ProjectSummary };
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success || !body.data?.project) {
        setError(body?.error?.message ?? "Failed to create project.");
        return;
      }

      onSuccess(body.data.project);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 id="create-project-title" className="text-lg font-semibold tracking-tight">
          Create Project
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Projects organize related problems and AI workflows inside your workspace.
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-project-name">Project Name</Label>
            <Input
              id="create-project-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-project-desc">Description (optional)</Label>
            <Textarea
              id="create-project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What problems and improvements does this project address?"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Project Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`size-6 rounded-full border-2 transition-transform ${
                    color === preset.value ? "scale-115 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-7 cursor-pointer appearance-none rounded border-0 bg-transparent p-0"
                title="Custom color"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit Project Dialog                                                        */
/* -------------------------------------------------------------------------- */

interface EditProjectDialogProps {
  workspaceId: string;
  project: ProjectSummary;
  onClose: () => void;
  onSuccess: (project: ProjectSummary) => void;
}

function EditProjectDialog({ workspaceId, project, onClose, onSuccess }: EditProjectDialogProps) {
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description || "");
  const [color, setColor] = React.useState(project.color);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { project: ProjectSummary };
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success || !body.data?.project) {
        setError(body?.error?.message ?? "Failed to update project.");
        return;
      }

      onSuccess(body.data.project);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 id="edit-project-title" className="text-lg font-semibold tracking-tight">
          Edit Project
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Update project information and color.</p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-name">Project Name</Label>
            <Input
              id="edit-project-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-desc">Description</Label>
            <Textarea
              id="edit-project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Project Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`size-6 rounded-full border-2 transition-transform ${
                    color === preset.value ? "scale-115 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-7 cursor-pointer appearance-none rounded border-0 bg-transparent p-0"
                title="Custom color"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Archive / Restore Project Dialog                                           */
/* -------------------------------------------------------------------------- */

interface ArchiveProjectDialogProps {
  workspaceId: string;
  project: ProjectSummary;
  onClose: () => void;
  onSuccess: (project: ProjectSummary) => void;
}

function ArchiveProjectDialog({
  workspaceId,
  project,
  onClose,
  onSuccess,
}: ArchiveProjectDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isArchived = project.status === "archived";
  const newStatus = isArchived ? "active" : "archived";

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleToggle() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { project: ProjectSummary };
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success || !body.data?.project) {
        setError(body?.error?.message ?? "Failed to update project status.");
        return;
      }

      onSuccess(body.data.project);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 id="archive-project-title" className="text-lg font-semibold tracking-tight">
          {isArchived ? "Restore Project?" : "Archive Project?"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isArchived
            ? `Restore "${project.name}" back to active projects?`
            : `"${project.name}" will no longer appear in active projects. You can still access it anytime under the Archived filter.`}
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleToggle} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isArchived ? "Restore Project" : "Archive Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delete Project Dialog                                                      */
/* -------------------------------------------------------------------------- */

interface DeleteProjectDialogProps {
  workspaceId: string;
  project: ProjectSummary;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteProjectDialog({
  workspaceId,
  project,
  onClose,
  onSuccess,
}: DeleteProjectDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleDelete() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
        method: "DELETE",
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success) {
        setError(body?.error?.message ?? "Failed to delete project.");
        return;
      }

      onSuccess();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3
          id="delete-project-title"
          className="text-lg font-semibold tracking-tight text-destructive"
        >
          Delete Project?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <strong className="font-semibold text-foreground">{project.name}</strong>? This action
          permanently removes the project and cannot be undone.
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete Project
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ArchiveProjectDialog, CreateProjectDialog, DeleteProjectDialog, EditProjectDialog };
