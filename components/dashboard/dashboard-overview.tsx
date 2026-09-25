"use client";

import {
  Archive,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Layers,
  Plus,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CreateProjectDialog } from "@/components/project/project-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKSPACE_ROLE_LABELS } from "@/lib/constants/domain";
import { formatDate } from "@/lib/utils";
import type { DashboardOverview as DashboardData } from "@/services/dashboard.service";
import { canCreateProject } from "@/services/permission.service";

export interface DashboardOverviewProps {
  userName: string;
  data: DashboardData;
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeGreeting = "Welcome back";
  if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
  else if (hour >= 12 && hour < 18) timeGreeting = "Good afternoon";
  else if (hour >= 18 || hour < 5) timeGreeting = "Good evening";

  return `${timeGreeting}, ${name || "there"} 👋`;
}

export function DashboardOverview({ userName, data }: DashboardOverviewProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { workspace, projects, members, recentProjects } = data;
  const canCreate = canCreateProject(workspace.userRole);

  const activePercent =
    projects.total > 0 ? Math.round((projects.active / projects.total) * 100) : 0;
  const archivedPercent =
    projects.total > 0 ? Math.round((projects.archived / projects.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{getGreeting(userName)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s an overview of your SolvePilot workspace.
          </p>
        </div>

        {canCreate ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-3 self-start sm:mt-0 sm:self-auto"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Project
          </Button>
        ) : null}
      </header>

      {/* Top Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <FolderKanban className="size-4 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.total}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {projects.active} active · {projects.archived} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Projects
            </CardTitle>
            <CheckCircle2
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.active}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activePercent}% of workspace projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archived</CardTitle>
            <Archive className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.archived}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {archivedPercent}% preserved projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Workspace Members
            </CardTitle>
            <Users className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{members.total}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Your role:</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {WORKSPACE_ROLE_LABELS[workspace.userRole] ?? workspace.userRole}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Projects Overview & Workspace Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project Status Visualization (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Projects Overview</CardTitle>
                <CardDescription className="text-xs">
                  Distribution of active and archived projects in this workspace.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href="/dashboard/projects"
                  className="inline-flex items-center gap-1 text-xs font-medium"
                >
                  View all
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {projects.total === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <FolderKanban className="size-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">No projects in this workspace yet</p>
                <p className="text-xs text-muted-foreground">
                  Create a project to start tracking problems and workflows.
                </p>
                {canCreate ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-3">
                    <Plus className="size-4" aria-hidden="true" />
                    Create First Project
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Visual Segmented Progress Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      Active: {projects.active} ({activePercent}%)
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                      Archived: {projects.archived} ({archivedPercent}%)
                    </span>
                  </div>

                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      style={{ width: `${activePercent}%` }}
                      className="bg-emerald-500 transition-all duration-500"
                      title={`Active: ${projects.active}`}
                    />
                    <div
                      style={{ width: `${archivedPercent}%` }}
                      className="bg-amber-500 transition-all duration-500"
                      title={`Archived: ${projects.archived}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Active Workflows</span>
                    <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {projects.active}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Archived Records</span>
                    <span className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {projects.archived}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workspace Card (1 col) */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Workspace</CardTitle>
            <CardDescription className="text-xs">Your current active workspace.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{workspace.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    /{workspace.slug}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Members</p>
                  <p className="text-lg font-bold">{members.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="text-lg font-bold">{projects.total}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t pt-4">
              <Button variant="outline" size="sm" asChild className="w-full justify-between">
                <Link href="/dashboard/settings#workspaces">
                  <span className="inline-flex items-center gap-2">
                    <Settings className="size-4" aria-hidden="true" />
                    Manage Workspace
                  </span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Projects (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Recent Projects</CardTitle>
                <CardDescription className="text-xs">
                  Recently created projects in this workspace.
                </CardDescription>
              </div>

              {projects.total > 0 ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/projects" className="text-xs font-medium">
                    All Projects ({projects.total})
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No projects created yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y">
                {recentProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/projects/${p.id}`}
                    className="group -mx-2 flex items-center justify-between rounded-md p-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: p.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:underline">
                          {p.name}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3" aria-hidden="true" />
                          {formatDate(p.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>
                        {p.status === "active" ? "Active" : "Archived"}
                      </Badge>
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Future Modules (1 col) */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {canCreate ? (
                <Button onClick={() => setCreateOpen(true)} className="justify-start">
                  <Plus className="size-4" aria-hidden="true" />
                  Create New Project
                </Button>
              ) : null}

              <Button variant="outline" asChild className="justify-start">
                <Link href="/dashboard/projects">
                  <FolderKanban className="size-4" aria-hidden="true" />
                  View All Projects
                </Link>
              </Button>

              <Button variant="outline" asChild className="justify-start">
                <Link href="/dashboard/settings#workspace-members">
                  <Users className="size-4" aria-hidden="true" />
                  Workspace Members
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Future Modules Notice (No fake data) */}
          <Card className="border-dashed bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold">Upcoming Modules</CardTitle>
              </div>
              <CardDescription className="text-xs">
                SolvePilot is built in phases. Live problem and AI statistics will appear here as
                features activate.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Layers className="size-3.5" aria-hidden="true" />
                  <span>Problem Lifecycle &amp; Tasks (Next Tasks)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>AI Diagnosis &amp; Verification</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Project Modal */}
      {createOpen ? (
        <CreateProjectDialog
          workspaceId={workspace.id}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
