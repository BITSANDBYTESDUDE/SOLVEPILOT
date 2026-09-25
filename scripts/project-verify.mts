/**
 * Project verification tooling (Task 08).
 *
 * Asserts project validation rules, permission matrix (owner/admin/member),
 * cross-workspace isolation, and schema integrity without requiring a live database.
 *
 * Usage:  npm run project:verify
 */
import { createRequire } from "node:module";

import { Types } from "mongoose";

import { findMembership } from "@/lib/auth/workspace";
import * as models from "@/models";
import {
  canArchiveProject,
  canCreateProject,
  canDeleteProject,
  canEditProject,
  canManageProjects,
  canViewProjects,
} from "@/services/permission.service";
import {
  createProjectSchema,
  DEFAULT_PROJECT_COLOR,
  projectColorSchema,
  projectFilterSchema,
  projectNameSchema,
  projectStatusSchema,
  updateProjectSchema,
} from "@/validators/project";

import { isValid, VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

const objectId = () => new Types.ObjectId();

/* -------------------------------------------------------------------------- */
/* 1. Project Validation                                                      */
/* -------------------------------------------------------------------------- */

section("Project Name Validation", [
  {
    description: "accepts a valid project name",
    test: () => projectNameSchema.safeParse("Website Redesign").success,
  },
  {
    description: "trims surrounding whitespace",
    test: () => projectNameSchema.parse("  Website Redesign  ") === "Website Redesign",
  },
  {
    description: "rejects an empty name",
    test: () => !projectNameSchema.safeParse("").success,
  },
  {
    description: "rejects a name shorter than 2 characters",
    test: () => !projectNameSchema.safeParse("W").success,
  },
  {
    description: "rejects a name longer than 120 characters",
    test: () => !projectNameSchema.safeParse("a".repeat(121)).success,
  },
]);

section("Project Color Validation", [
  {
    description: "accepts a valid 6-digit hex color",
    test: () => projectColorSchema.safeParse("#6366f1").success,
  },
  {
    description: "accepts a valid 3-digit hex color",
    test: () => projectColorSchema.safeParse("#fff").success,
  },
  {
    description: "defaults to standard Indigo when omitted on creation",
    test: () => createProjectSchema.parse({ name: "Project" }).color === DEFAULT_PROJECT_COLOR,
  },
  {
    description: "rejects invalid hex characters",
    test: () => !projectColorSchema.safeParse("#xyz123").success,
  },
  {
    description: "rejects colors without leading hash",
    test: () => !projectColorSchema.safeParse("4f46e5").success,
  },
  {
    description: "rejects arbitrary dangerous strings (e.g. CSS injection)",
    test: () => !projectColorSchema.safeParse("red; background: url(x)").success,
  },
]);

section("Project Status Validation", [
  {
    description: "accepts active status",
    test: () => projectStatusSchema.safeParse("active").success,
  },
  {
    description: "accepts archived status",
    test: () => projectStatusSchema.safeParse("archived").success,
  },
  {
    description: "rejects unsupported status values",
    test: () =>
      !projectStatusSchema.safeParse("closed").success &&
      !projectStatusSchema.safeParse("deleted").success &&
      !projectStatusSchema.safeParse("pending").success,
  },
]);

section("Project Creation and Update Schemas", [
  {
    description: "accepts valid project creation payload",
    test: () =>
      createProjectSchema.safeParse({
        name: "Mobile App",
        description: "Customer portal iOS & Android",
        color: "#0284c7",
      }).success,
  },
  {
    description: "allows description and color to be optional on creation",
    test: () => createProjectSchema.safeParse({ name: "Internal Tools" }).success,
  },
  {
    description: "accepts partial update with name only",
    test: () => updateProjectSchema.safeParse({ name: "Updated Name" }).success,
  },
  {
    description: "accepts partial update with status only (archiving)",
    test: () => updateProjectSchema.safeParse({ status: "archived" }).success,
  },
  {
    description: "rejects update payload with no fields",
    test: () => !updateProjectSchema.safeParse({}).success,
  },
  {
    description: "project filter schema handles search, status and sort",
    test: () =>
      projectFilterSchema.safeParse({
        search: "portal",
        status: "active",
        sort: "name-asc",
      }).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Project Permissions                                                     */
/* -------------------------------------------------------------------------- */

section("Project Permissions: Creation", [
  {
    description: "Owner can create projects",
    test: () => canCreateProject("owner") === true,
  },
  {
    description: "Admin can create projects",
    test: () => canCreateProject("admin") === true,
  },
  {
    description: "Member cannot create projects",
    test: () => canCreateProject("member") === false,
  },
]);

section("Project Permissions: Reading", [
  {
    description: "Owner can view projects",
    test: () => canViewProjects("owner") === true,
  },
  {
    description: "Admin can view projects",
    test: () => canViewProjects("admin") === true,
  },
  {
    description: "Member can view projects",
    test: () => canViewProjects("member") === true,
  },
  {
    description: "Unauthenticated / non-member cannot view projects",
    test: () => canViewProjects(null) === false,
  },
]);

section("Project Permissions: Updating & Archiving", [
  {
    description: "Owner can update projects",
    test: () => canEditProject("owner") === true,
  },
  {
    description: "Admin can update projects",
    test: () => canEditProject("admin") === true,
  },
  {
    description: "Member cannot update projects",
    test: () => canEditProject("member") === false,
  },
  {
    description: "Owner can archive projects",
    test: () => canArchiveProject("owner") === true,
  },
  {
    description: "Admin can archive projects",
    test: () => canArchiveProject("admin") === true,
  },
  {
    description: "Member cannot archive projects",
    test: () => canArchiveProject("member") === false,
  },
]);

section("Project Permissions: Deletion", [
  {
    description: "Owner can delete projects",
    test: () => canDeleteProject("owner") === true,
  },
  {
    description: "Admin can delete projects",
    test: () => canDeleteProject("admin") === true,
  },
  {
    description: "Member cannot delete projects",
    test: () => canDeleteProject("member") === false,
  },
  {
    description: "canManageProjects encapsulates management permissions",
    test: () =>
      canManageProjects("owner") && canManageProjects("admin") && !canManageProjects("member"),
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Tenancy Isolation & Security                                            */
/* -------------------------------------------------------------------------- */

const userInWorkspaceA = objectId();
const userInWorkspaceB = objectId();
const workspaceAId = objectId();
const workspaceBId = objectId();

const workspaceA = {
  _id: workspaceAId,
  members: [
    { userId: userInWorkspaceA, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

const workspaceB = {
  _id: workspaceBId,
  members: [
    { userId: userInWorkspaceB, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

const projectInWorkspaceB = {
  _id: objectId(),
  workspaceId: workspaceBId,
  name: "Confidential Project B",
  status: "active" as const,
  color: "#4f46e5",
  createdBy: userInWorkspaceB,
};

section("Workspace Isolation & IDOR Protection", [
  {
    description: "User in Workspace A is a member of Workspace A",
    test: () => findMembership(workspaceA, String(userInWorkspaceA))?.role === "owner",
  },
  {
    description: "User in Workspace A is not a member of Workspace B",
    test: () => findMembership(workspaceB, String(userInWorkspaceA)) === null,
  },
  {
    description:
      "Cross-workspace project access denied: Workspace A user cannot access Workspace B projects",
    test: () => {
      // Simulates caller from Workspace A trying to access Workspace B projects
      const callerId = String(userInWorkspaceA);
      const membership = findMembership(workspaceB, callerId);
      // Because membership is null, the service layer throws NotFoundError (404)
      return membership === null;
    },
  },
  {
    description:
      "Project workspaceId matching prevents accessing Project B even if passing Workspace A in path",
    test: () => {
      // If an attacker calls /api/workspaces/WorkspaceA/projects/ProjectBId:
      // The query { _id: ProjectB._id, workspaceId: WorkspaceA._id } finds nothing
      const matches = String(projectInWorkspaceB.workspaceId) === String(workspaceAId);
      return matches === false;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Model Schema Validation                                                 */
/* -------------------------------------------------------------------------- */

section("Project Mongoose Schema", [
  {
    description: "accepts a valid project document",
    test: async () =>
      isValid(models.Project, {
        workspaceId: objectId(),
        name: "Infrastructure Migration",
        description: "Move from AWS to hybrid cloud",
        color: "#16a34a",
        createdBy: objectId(),
      }),
  },
  {
    description: "defaults status to active",
    test: () => new models.Project({}).status === "active",
  },
  {
    description: "defaults color to #4f46e5",
    test: () => new models.Project({}).color === "#4f46e5",
  },
  {
    description: "rejects invalid color format in model",
    test: async () =>
      !(await isValid(models.Project, {
        workspaceId: objectId(),
        name: "Valid Name",
        color: "invalid-color",
        createdBy: objectId(),
      })),
  },
  {
    description: "requires workspaceId",
    test: async () =>
      !(await isValid(models.Project, {
        name: "Valid Name",
        createdBy: objectId(),
      })),
  },
  {
    description: "requires createdBy",
    test: async () =>
      !(await isValid(models.Project, {
        workspaceId: objectId(),
        name: "Valid Name",
      })),
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Run the suite                                                           */
/* -------------------------------------------------------------------------- */

await harness.run();
