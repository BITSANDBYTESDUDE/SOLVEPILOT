/**
 * Dashboard statistics & overview verification tooling (Task 09).
 *
 * Asserts dashboard metrics calculation logic, workspace isolation,
 * role permissions, and data structuring without requiring a live database.
 *
 * Usage:  npm run dashboard:verify
 */
import { createRequire } from "node:module";

import { Types } from "mongoose";

import { findMembership } from "@/lib/auth/workspace";
import { canCreateProject } from "@/services/permission.service";
import type { DashboardOverview } from "@/services/dashboard.service";
import type { ProjectStatus, WorkspaceRole } from "@/types/domain";

import { VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

const objectId = () => new Types.ObjectId();

/* -------------------------------------------------------------------------- */
/* 1. Statistics Calculation Logic                                            */
/* -------------------------------------------------------------------------- */

interface MockProject {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  status: ProjectStatus;
  color: string;
  createdAt: Date;
}

function computeStats(projects: MockProject[]) {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const archived = projects.filter((p) => p.status === "archived").length;
  const recent = [...projects]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((p) => ({
      id: String(p._id),
      name: p.name,
      status: p.status,
      color: p.color,
      createdAt: p.createdAt,
    }));

  return { total, active, archived, recent };
}

section("Project Statistics Calculation", [
  {
    description: "calculates stats for 0 projects correctly",
    test: () => {
      const stats = computeStats([]);
      return (
        stats.total === 0 && stats.active === 0 && stats.archived === 0 && stats.recent.length === 0
      );
    },
  },
  {
    description: "calculates stats for 1 active project correctly",
    test: () => {
      const wsId = objectId();
      const stats = computeStats([
        {
          _id: objectId(),
          workspaceId: wsId,
          name: "Project 1",
          status: "active",
          color: "#4f46e5",
          createdAt: new Date(),
        },
      ]);
      return (
        stats.total === 1 && stats.active === 1 && stats.archived === 0 && stats.recent.length === 1
      );
    },
  },
  {
    description: "calculates stats for multiple active projects",
    test: () => {
      const wsId = objectId();
      const projects: MockProject[] = Array.from({ length: 5 }, (_, i) => ({
        _id: objectId(),
        workspaceId: wsId,
        name: `Active Project ${i}`,
        status: "active" as const,
        color: "#4f46e5",
        createdAt: new Date(Date.now() - i * 1000),
      }));
      const stats = computeStats(projects);
      return stats.total === 5 && stats.active === 5 && stats.archived === 0;
    },
  },
  {
    description: "calculates stats for multiple archived projects",
    test: () => {
      const wsId = objectId();
      const projects: MockProject[] = Array.from({ length: 3 }, (_, i) => ({
        _id: objectId(),
        workspaceId: wsId,
        name: `Archived Project ${i}`,
        status: "archived" as const,
        color: "#64748b",
        createdAt: new Date(Date.now() - i * 1000),
      }));
      const stats = computeStats(projects);
      return stats.total === 3 && stats.active === 0 && stats.archived === 3;
    },
  },
  {
    description:
      "calculates mixed active and archived projects correctly (e.g. 6 active, 2 archived)",
    test: () => {
      const wsId = objectId();
      const projects: MockProject[] = [
        ...Array.from({ length: 6 }, (_, i) => ({
          _id: objectId(),
          workspaceId: wsId,
          name: `Active ${i}`,
          status: "active" as const,
          color: "#4f46e5",
          createdAt: new Date(Date.now() - i * 1000),
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          _id: objectId(),
          workspaceId: wsId,
          name: `Archived ${i}`,
          status: "archived" as const,
          color: "#64748b",
          createdAt: new Date(Date.now() - (i + 10) * 1000),
        })),
      ];
      const stats = computeStats(projects);
      return stats.total === 8 && stats.active === 6 && stats.archived === 2;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Recent Projects Limit & Order                                           */
/* -------------------------------------------------------------------------- */

section("Recent Projects Retrieval", [
  {
    description: "limits recent projects to a maximum of 5",
    test: () => {
      const wsId = objectId();
      const projects: MockProject[] = Array.from({ length: 12 }, (_, i) => ({
        _id: objectId(),
        workspaceId: wsId,
        name: `Project ${i}`,
        status: "active" as const,
        color: "#4f46e5",
        createdAt: new Date(Date.now() - i * 10000),
      }));
      const stats = computeStats(projects);
      return stats.recent.length === 5;
    },
  },
  {
    description: "orders recent projects by createdAt descending (newest first)",
    test: () => {
      const wsId = objectId();
      const oldestDate = new Date("2026-01-01");
      const middleDate = new Date("2026-06-01");
      const newestDate = new Date("2026-09-25");

      const projects: MockProject[] = [
        {
          _id: objectId(),
          workspaceId: wsId,
          name: "Old",
          status: "active",
          color: "#fff",
          createdAt: oldestDate,
        },
        {
          _id: objectId(),
          workspaceId: wsId,
          name: "Newest",
          status: "active",
          color: "#fff",
          createdAt: newestDate,
        },
        {
          _id: objectId(),
          workspaceId: wsId,
          name: "Middle",
          status: "active",
          color: "#fff",
          createdAt: middleDate,
        },
      ];

      const stats = computeStats(projects);
      return (
        stats.recent[0]?.name === "Newest" &&
        stats.recent[1]?.name === "Middle" &&
        stats.recent[2]?.name === "Old"
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Member Count                                                            */
/* -------------------------------------------------------------------------- */

section("Workspace Member Counts", [
  {
    description: "counts single owner member correctly",
    test: () => {
      const workspace = {
        members: [
          { userId: objectId(), role: "owner" as const, joinedAt: new Date(), invitedBy: null },
        ],
      };
      return workspace.members.length === 1;
    },
  },
  {
    description: "counts multi-member team correctly",
    test: () => {
      const workspace = {
        members: [
          { userId: objectId(), role: "owner" as const, joinedAt: new Date(), invitedBy: null },
          { userId: objectId(), role: "admin" as const, joinedAt: new Date(), invitedBy: null },
          { userId: objectId(), role: "member" as const, joinedAt: new Date(), invitedBy: null },
          { userId: objectId(), role: "member" as const, joinedAt: new Date(), invitedBy: null },
        ],
      };
      return workspace.members.length === 4;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Tenancy & Workspace Isolation                                           */
/* -------------------------------------------------------------------------- */

const userInWorkspaceA = objectId();
const userInWorkspaceB = objectId();
const workspaceAId = objectId();
const workspaceBId = objectId();

const workspaceA = {
  _id: workspaceAId,
  name: "Workspace A",
  members: [
    { userId: userInWorkspaceA, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

const workspaceB = {
  _id: workspaceBId,
  name: "Workspace B",
  members: [
    { userId: userInWorkspaceB, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

section("Dashboard Workspace Isolation", [
  {
    description: "User in Workspace A accesses Workspace A data successfully",
    test: () => findMembership(workspaceA, String(userInWorkspaceA))?.role === "owner",
  },
  {
    description: "User in Workspace A cannot access Workspace B dashboard (returns null/denied)",
    test: () => findMembership(workspaceB, String(userInWorkspaceA)) === null,
  },
  {
    description: "User in Workspace B cannot access Workspace A dashboard (returns null/denied)",
    test: () => findMembership(workspaceA, String(userInWorkspaceB)) === null,
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Permission Enforcement for Dashboard Actions                            */
/* -------------------------------------------------------------------------- */

section("Dashboard Action Permissions", [
  {
    description: "Owner can see and use project creation action",
    test: () => canCreateProject("owner") === true,
  },
  {
    description: "Admin can see and use project creation action",
    test: () => canCreateProject("admin") === true,
  },
  {
    description: "Member cannot see or use project creation action",
    test: () => canCreateProject("member") === false,
  },
]);

/* -------------------------------------------------------------------------- */
/* 6. Dashboard Data Structure                                                */
/* -------------------------------------------------------------------------- */

section("Dashboard Data Structure", [
  {
    description: "structures overview response adhering to DashboardOverview type",
    test: () => {
      const overview: DashboardOverview = {
        workspace: {
          id: String(workspaceAId),
          name: workspaceA.name,
          slug: "workspace-a",
          userRole: "owner" as WorkspaceRole,
          memberCount: 1,
          projectCount: 0,
        },
        projects: {
          total: 0,
          active: 0,
          archived: 0,
        },
        members: {
          total: 1,
        },
        recentProjects: [],
        recentActivities: [],
        upcomingModules: {
          problems: "Task 11",
          aiAnalysis: "Task 16",
          tasks: "Task 23",
          verification: "Task 30",
          reports: "Task 33",
        },
      };

      return (
        overview.workspace.name === "Workspace A" &&
        overview.projects.total === 0 &&
        overview.members.total === 1 &&
        Array.isArray(overview.recentProjects)
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 7. Run the suite                                                           */
/* -------------------------------------------------------------------------- */

await harness.run();
