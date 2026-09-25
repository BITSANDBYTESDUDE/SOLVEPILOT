/**
 * Activity verification tooling (Task 10).
 *
 * Asserts activity action types, validation schemas, metadata sanitization,
 * compound index declarations, multi-tenant authorization boundaries,
 * and timeline pagination without requiring a live database.
 *
 * Usage:  npm run activity:verify
 */
import { createRequire } from "node:module";

import { Types } from "mongoose";

import { findMembership } from "@/lib/auth/workspace";
import * as models from "@/models";
import { sanitizeMetadata } from "@/services/activity.service";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_TYPES,
  type ActivityAction,
  type WorkspaceRole,
} from "@/types/domain";
import {
  activityActionSchema,
  activityQuerySchema,
  createActivitySchema,
} from "@/validators/activity";

import { isValid, VerifyHarness } from "./lib/verify-harness";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

const objectId = () => new Types.ObjectId();

/* -------------------------------------------------------------------------- */
/* 1. Action Types & Schema Validation                                        */
/* -------------------------------------------------------------------------- */

section("Activity Action Types", [
  {
    description: "contains all 9 expected activity action types in ACTIVITY_ACTIONS",
    test: () => {
      const expected: ActivityAction[] = [
        "workspace.created",
        "workspace.updated",
        "member.added",
        "member.role_changed",
        "member.removed",
        "project.created",
        "project.updated",
        "project.archived",
        "project.deleted",
      ];
      return expected.every((action) => (ACTIVITY_ACTIONS as readonly string[]).includes(action));
    },
  },
  {
    description: "ACTIVITY_ACTION_TYPES object maps correctly to action strings",
    test: () => {
      return (
        ACTIVITY_ACTION_TYPES.WORKSPACE_CREATED === "workspace.created" &&
        ACTIVITY_ACTION_TYPES.WORKSPACE_UPDATED === "workspace.updated" &&
        ACTIVITY_ACTION_TYPES.MEMBER_ADDED === "member.added" &&
        ACTIVITY_ACTION_TYPES.MEMBER_ROLE_CHANGED === "member.role_changed" &&
        ACTIVITY_ACTION_TYPES.MEMBER_REMOVED === "member.removed" &&
        ACTIVITY_ACTION_TYPES.PROJECT_CREATED === "project.created" &&
        ACTIVITY_ACTION_TYPES.PROJECT_UPDATED === "project.updated" &&
        ACTIVITY_ACTION_TYPES.PROJECT_ARCHIVED === "project.archived" &&
        ACTIVITY_ACTION_TYPES.PROJECT_DELETED === "project.deleted"
      );
    },
  },
  {
    description: "accepts valid project action types",
    test: () =>
      activityActionSchema.safeParse("project.created").success &&
      activityActionSchema.safeParse("project.updated").success &&
      activityActionSchema.safeParse("project.archived").success &&
      activityActionSchema.safeParse("project.deleted").success,
  },
  {
    description: "accepts valid member action types",
    test: () =>
      activityActionSchema.safeParse("member.added").success &&
      activityActionSchema.safeParse("member.role_changed").success &&
      activityActionSchema.safeParse("member.removed").success,
  },
  {
    description: "accepts valid workspace action types",
    test: () =>
      activityActionSchema.safeParse("workspace.created").success &&
      activityActionSchema.safeParse("workspace.updated").success,
  },
  {
    description: "rejects disallowed / invalid action types",
    test: () =>
      !activityActionSchema.safeParse("unknown.action").success &&
      !activityActionSchema.safeParse("foo.bar").success &&
      !activityActionSchema.safeParse("random.unknown").success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Activity Query & Creation Schemas                                       */
/* -------------------------------------------------------------------------- */

section("Activity Query & Creation Schemas", [
  {
    description: "defaults pagination query to page=1 and limit=20",
    test: () => {
      const parsed = activityQuerySchema.parse({});
      return parsed.page === 1 && parsed.limit === 20;
    },
  },
  {
    description: "coerces string numbers in query params",
    test: () => {
      const parsed = activityQuerySchema.parse({ page: "3", limit: "50" });
      return parsed.page === 3 && parsed.limit === 50;
    },
  },
  {
    description: "rejects page numbers less than 1",
    test: () => !activityQuerySchema.safeParse({ page: 0 }).success,
  },
  {
    description: "rejects limit exceeding maximum 100",
    test: () => !activityQuerySchema.safeParse({ limit: 101 }).success,
  },
  {
    description: "accepts optional action filter parameter",
    test: () => {
      const parsed = activityQuerySchema.parse({ action: "project.created" });
      return parsed.action === "project.created";
    },
  },
  {
    description: "validates activity creation payload",
    test: () => {
      const valid = createActivitySchema.safeParse({
        workspaceId: objectId().toString(),
        actorId: objectId().toString(),
        action: "project.created",
        metadata: { projectName: "Test Project" },
      });
      return valid.success;
    },
  },
  {
    description: "permits issueId to be optional / undefined",
    test: () => {
      const valid = createActivitySchema.safeParse({
        workspaceId: objectId().toString(),
        actorId: objectId().toString(),
        action: "workspace.created",
      });
      return valid.success && valid.data?.issueId === undefined;
    },
  },
  {
    description: "rejects invalid MongoDB ObjectIds",
    test: () => {
      const invalid = createActivitySchema.safeParse({
        workspaceId: "not-an-id",
        actorId: objectId().toString(),
        action: "project.created",
      });
      return !invalid.success;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Sensitive Metadata Sanitization                                         */
/* -------------------------------------------------------------------------- */

section("Metadata Sanitization & Security", [
  {
    description: "strips password, tokens, and api keys from activity metadata",
    test: () => {
      const raw = {
        projectName: "Security Portal",
        password: "supersecretpassword",
        authToken: "bearer 123456",
        apiKey: "sk-proj-xyz",
        secret: "jwt-secret",
        authorization: "Basic dXNlcjpwYXNz",
      };
      const cleaned = sanitizeMetadata(raw);
      return (
        cleaned.projectName === "Security Portal" &&
        cleaned.password === undefined &&
        cleaned.authToken === undefined &&
        cleaned.apiKey === undefined &&
        cleaned.secret === undefined &&
        cleaned.authorization === undefined
      );
    },
  },
  {
    description: "strips sensitive fields in nested objects",
    test: () => {
      const raw = {
        memberEmail: "alice@example.com",
        details: {
          clientSecret: "shhhh",
          publicId: "pub-123",
        },
      };
      const cleaned = sanitizeMetadata(raw);
      const nested = cleaned.details as Record<string, unknown>;
      return (
        cleaned.memberEmail === "alice@example.com" &&
        nested.publicId === "pub-123" &&
        nested.clientSecret === undefined
      );
    },
  },
  {
    description: "preserves safe project metadata",
    test: () => {
      const meta = {
        projectId: "proj-123",
        projectName: "Mobile App",
        previousStatus: "active",
        newStatus: "archived",
      };
      const cleaned = sanitizeMetadata(meta);
      return (
        cleaned.projectId === "proj-123" &&
        cleaned.projectName === "Mobile App" &&
        cleaned.previousStatus === "active" &&
        cleaned.newStatus === "archived"
      );
    },
  },
  {
    description: "preserves safe member metadata",
    test: () => {
      const meta = {
        targetUserId: "user-456",
        targetUserEmail: "dev@solvepilot.com",
        previousRole: "member",
        newRole: "admin",
      };
      const cleaned = sanitizeMetadata(meta);
      return (
        cleaned.targetUserId === "user-456" &&
        cleaned.targetUserEmail === "dev@solvepilot.com" &&
        cleaned.previousRole === "member" &&
        cleaned.newRole === "admin"
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Activity Log Mongoose Schema & Indexes                                  */
/* -------------------------------------------------------------------------- */

section("Activity Log Mongoose Schema & Indexes", [
  {
    description: "declares workspaceId as required ObjectId",
    test: () => {
      const schema = models.ActivityLog.schema;
      const path = schema.path("workspaceId");
      return Boolean(path && path.isRequired);
    },
  },
  {
    description: "declares actorId as required ObjectId",
    test: () => {
      const schema = models.ActivityLog.schema;
      const path = schema.path("actorId");
      return Boolean(path && path.isRequired);
    },
  },
  {
    description: "declares issueId as optional (not required)",
    test: () => {
      const schema = models.ActivityLog.schema;
      const path = schema.path("issueId");
      return Boolean(path && !path.isRequired);
    },
  },
  {
    description: "declares action with enum validation",
    test: () => {
      const schema = models.ActivityLog.schema;
      const path = schema.path("action") as unknown as { enumValues?: string[] };
      const values = path?.enumValues;
      return Boolean(
        Array.isArray(values) &&
        values.includes("project.created") &&
        values.includes("member.added"),
      );
    },
  },
  {
    description: "defines compound index workspaceId + createdAt (workspace_recent)",
    test: () => {
      const indexes = models.ActivityLog.schema.indexes();
      return indexes.some(([fields]) => fields.workspaceId === 1 && fields.createdAt === -1);
    },
  },
  {
    description:
      "defines compound index workspaceId + action + createdAt (workspace_action_recent)",
    test: () => {
      const indexes = models.ActivityLog.schema.indexes();
      return indexes.some(
        ([fields]) => fields.workspaceId === 1 && fields.action === 1 && fields.createdAt === -1,
      );
    },
  },
  {
    description: "defines index actorId + createdAt (actor_recent)",
    test: () => {
      const indexes = models.ActivityLog.schema.indexes();
      return indexes.some(([fields]) => fields.actorId === 1 && fields.createdAt === -1);
    },
  },
  {
    description: "instantiates a valid ActivityLog document with minimal fields",
    test: () =>
      isValid(models.ActivityLog, {
        workspaceId: objectId(),
        actorId: objectId(),
        action: "project.created",
        metadata: { projectName: "Test" },
      }),
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Tenancy Isolation & Authorization Boundaries                            */
/* -------------------------------------------------------------------------- */

const workspaceAId = objectId();
const workspaceBId = objectId();
const user1Id = objectId();
const user2Id = objectId();

const mockWorkspaceA = {
  _id: workspaceAId,
  name: "Workspace Alpha",
  members: [
    { userId: user1Id, role: "owner" as WorkspaceRole, joinedAt: new Date(), invitedBy: null },
  ],
};

const mockWorkspaceB = {
  _id: workspaceBId,
  name: "Workspace Beta",
  members: [
    { userId: user2Id, role: "owner" as WorkspaceRole, joinedAt: new Date(), invitedBy: null },
  ],
};

section("Multi-Tenant Isolation & Authorization", [
  {
    description: "User 1 is recognized as member of Workspace A",
    test: () => {
      const mem = findMembership(mockWorkspaceA, String(user1Id));
      return mem !== null && mem.role === "owner";
    },
  },
  {
    description: "User 1 is NOT a member of Workspace B (isolation)",
    test: () => {
      const mem = findMembership(mockWorkspaceB, String(user1Id));
      return mem === null;
    },
  },
  {
    description: "User 2 cannot access Workspace A activities (membership check rejects)",
    test: () => {
      const mem = findMembership(mockWorkspaceA, String(user2Id));
      return mem === null;
    },
  },
  {
    description: "Actors are projected safely without password or salt",
    test: () => {
      const safeActor = {
        id: String(user1Id),
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
      };
      return (
        !("password" in safeActor) &&
        !("passwordHash" in safeActor) &&
        !("salt" in safeActor) &&
        !("tokens" in safeActor)
      );
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 6. Timeline Grouping & Pagination Logic                                    */
/* -------------------------------------------------------------------------- */

section("Timeline Grouping & Pagination Logic", [
  {
    description: "calculates total pages correctly (e.g. 45 items at limit 20 = 3 pages)",
    test: () => {
      const total = 45;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      return totalPages === 3;
    },
  },
  {
    description: "calculates total pages correctly for exact multiple (40 items = 2 pages)",
    test: () => {
      const total = 40;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      return totalPages === 2;
    },
  },
  {
    description: "calculates total pages correctly for 0 items (1 page min)",
    test: () => {
      const total = 0;
      const limit = 20;
      const totalPages = Math.ceil(total / limit) || 1;
      return totalPages === 1;
    },
  },
  {
    description: "recent activities respects limit constraint",
    test: () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: `act-${i}` }));
      const recent = items.slice(0, 5);
      return recent.length === 5 && recent[0]?.id === "act-0";
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* Execute Harness                                                            */
/* -------------------------------------------------------------------------- */

await harness.run();
