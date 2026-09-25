/**
 * Workspace verification tooling (Task 06).
 *
 * Asserts the tenancy and validation rules the workspace module depends on,
 * without needing a database or the Next.js runtime: name and slug validation,
 * reserved slugs, the role hierarchy, and membership matching.
 *
 * The database-backed paths (create, unique-slug reservation, membership
 * queries) need a live MONGODB_URI to exercise end to end.
 *
 * Usage:  npm run workspace:verify
 */
import { createRequire } from "node:module";

import { Types } from "mongoose";

import { findMembership, hasAtLeastRole, rolesByPrivilege } from "@/lib/auth/workspace";
import {
  canAddWorkspaceMember,
  canChangeWorkspaceMemberRole,
  canEditWorkspace,
  canManageWorkspaceMembers,
  canRemoveWorkspaceMember,
  isWorkspaceAdmin,
  isWorkspaceMember,
  isWorkspaceOwner,
} from "@/services/permission.service";
import { slugify } from "@/lib/utils";
import {
  addWorkspaceMemberSchema,
  createWorkspaceSchema,
  objectIdSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceSchema,
  WORKSPACE_SLUG_MAX_LENGTH,
  workspaceRoleSchema,
} from "@/validators/workspace";

import { VerifyHarness } from "./lib/verify-harness";

// @next/env is CommonJS; load it through createRequire so this ESM script reads
// exactly the same .env files the Next.js runtime does.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const harness = new VerifyHarness();
const section = (title: string, assertions: Parameters<typeof harness.section>[1]) =>
  harness.section(title, assertions);

/* -------------------------------------------------------------------------- */
/* 1. Name                                                                     */
/* -------------------------------------------------------------------------- */

section("Workspace name", [
  {
    description: "accepts a valid name",
    test: () => createWorkspaceSchema.safeParse({ name: "Acme Engineering" }).success,
  },
  {
    description: "trims surrounding whitespace",
    test: () => createWorkspaceSchema.parse({ name: "  Acme  " }).name === "Acme",
  },
  {
    description: "rejects a name shorter than 2 characters",
    test: () => !createWorkspaceSchema.safeParse({ name: "A" }).success,
  },
  {
    description: "rejects a name longer than 80 characters",
    test: () => !createWorkspaceSchema.safeParse({ name: "a".repeat(81) }).success,
  },
  {
    description: "requires a name",
    test: () => !createWorkspaceSchema.safeParse({}).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Slug                                                                     */
/* -------------------------------------------------------------------------- */

section("Workspace slug", [
  {
    description: "is optional — it can be derived from the name",
    test: () => createWorkspaceSchema.safeParse({ name: "Acme Engineering" }).success,
  },
  {
    description: "lowercases a supplied slug",
    test: () =>
      createWorkspaceSchema.parse({ name: "Acme", slug: "ACME-Team" }).slug === "acme-team",
  },
  {
    description: "rejects spaces and punctuation",
    test: () => !createWorkspaceSchema.safeParse({ name: "Acme", slug: "acme team!" }).success,
  },
  {
    description: "rejects consecutive hyphens",
    test: () => !createWorkspaceSchema.safeParse({ name: "Acme", slug: "acme--team" }).success,
  },
  {
    description: "rejects a leading or trailing hyphen",
    test: () =>
      !createWorkspaceSchema.safeParse({ name: "Acme", slug: "-acme" }).success &&
      !createWorkspaceSchema.safeParse({ name: "Acme", slug: "acme-" }).success,
  },
  {
    description: "rejects an underscore",
    test: () => !createWorkspaceSchema.safeParse({ name: "Acme", slug: "acme_team" }).success,
  },
  {
    description: `rejects a slug longer than ${WORKSPACE_SLUG_MAX_LENGTH} characters`,
    test: () =>
      !createWorkspaceSchema.safeParse({
        name: "Acme",
        slug: "a".repeat(WORKSPACE_SLUG_MAX_LENGTH + 1),
      }).success,
  },
]);

section("Reserved slugs cannot be taken", [
  {
    description: "rejects route-colliding slugs",
    test: () =>
      ["api", "dashboard", "login", "settings", "admin", "share"].every(
        (slug) => !createWorkspaceSchema.safeParse({ name: "Acme", slug }).success,
      ),
  },
  {
    description: "rejects them case-insensitively",
    test: () =>
      ["API", "Dashboard", "LOGIN"].every(
        (slug) => !createWorkspaceSchema.safeParse({ name: "Acme", slug }).success,
      ),
  },
  {
    description: "allows an ordinary slug",
    test: () => createWorkspaceSchema.safeParse({ name: "Acme", slug: "acme-team" }).success,
  },
]);

section("Slug derivation from a name", [
  {
    description: "slugifies spaces and capitals",
    test: () => slugify("Acme Engineering") === "acme-engineering",
  },
  {
    description: "collapses runs of punctuation into one hyphen",
    test: () => slugify("  Hello,   World!!  ") === "hello-world",
  },
  {
    description: "strips diacritics",
    test: () => slugify("Crème Brûlée") === "creme-brulee",
  },
  {
    description: "returns an empty string for a purely non-Latin name",
    test: () => slugify("日本語") === "",
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Updates                                                                  */
/* -------------------------------------------------------------------------- */

section("Workspace updates", [
  {
    description: "accepts a name-only update",
    test: () => updateWorkspaceSchema.safeParse({ name: "Renamed" }).success,
  },
  {
    description: "accepts a slug-only update",
    test: () => updateWorkspaceSchema.safeParse({ slug: "renamed" }).success,
  },
  {
    description: "rejects an update with no fields",
    test: () => !updateWorkspaceSchema.safeParse({}).success,
  },
  {
    description: "rejects an invalid slug on update too",
    test: () => !updateWorkspaceSchema.safeParse({ slug: "Bad Slug" }).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Role hierarchy                                                           */
/* -------------------------------------------------------------------------- */

section("Role hierarchy", [
  {
    description: "owner satisfies every requirement",
    test: () =>
      ["owner", "admin", "member"].every((required) =>
        hasAtLeastRole("owner", required as "owner" | "admin" | "member"),
      ),
  },
  {
    description: "admin satisfies admin and member but not owner",
    test: () =>
      hasAtLeastRole("admin", "admin") &&
      hasAtLeastRole("admin", "member") &&
      !hasAtLeastRole("admin", "owner"),
  },
  {
    description: "member satisfies only member",
    test: () =>
      hasAtLeastRole("member", "member") &&
      !hasAtLeastRole("member", "admin") &&
      !hasAtLeastRole("member", "owner"),
  },
  {
    description: "every role satisfies itself",
    test: () => rolesByPrivilege().every((role) => hasAtLeastRole(role, role)),
  },
  {
    description: "privilege ordering is owner, admin, member",
    test: () => rolesByPrivilege().join(",") === "owner,admin,member",
  },
]);

/* -------------------------------------------------------------------------- */
/* 5. Membership matching                                                      */
/* -------------------------------------------------------------------------- */

const ownerObjectId = new Types.ObjectId();
const otherObjectId = new Types.ObjectId();

const workspace = {
  members: [
    { userId: ownerObjectId, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
    { userId: otherObjectId, role: "member" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

section("Membership matching", [
  {
    description: "finds a member by their ObjectId",
    test: () => findMembership(workspace, String(ownerObjectId))?.role === "owner",
  },
  {
    description: "returns the caller's own role, not the first member's",
    test: () => findMembership(workspace, String(otherObjectId))?.role === "member",
  },
  {
    description: "returns null for a non-member",
    test: () => findMembership(workspace, String(new Types.ObjectId())) === null,
  },
  {
    description: "returns null for an empty id rather than matching the first member",
    test: () => findMembership(workspace, "") === null,
  },
  {
    description: "returns null when the workspace has no members",
    test: () => findMembership({ members: [] }, String(ownerObjectId)) === null,
  },
]);

/* -------------------------------------------------------------------------- */
/* 6. Member input validation (Task 07)                                       */
/* -------------------------------------------------------------------------- */

section("Workspace member validation", [
  {
    description: "accepts valid add member data with email and role",
    test: () =>
      addWorkspaceMemberSchema.safeParse({ email: "newmember@example.com", role: "member" })
        .success,
  },
  {
    description: "defaults role to member when omitted",
    test: () =>
      addWorkspaceMemberSchema.parse({ email: "newmember@example.com" }).role === "member",
  },
  {
    description: "lowercases email address",
    test: () =>
      addWorkspaceMemberSchema.parse({ email: "USER@EXAMPLE.COM" }).email === "user@example.com",
  },
  {
    description: "rejects invalid email address",
    test: () => !addWorkspaceMemberSchema.safeParse({ email: "not-an-email" }).success,
  },
  {
    description: "rejects empty email address",
    test: () => !addWorkspaceMemberSchema.safeParse({ email: "" }).success,
  },
  {
    description: "rejects invalid role in add member",
    test: () =>
      !addWorkspaceMemberSchema.safeParse({ email: "user@example.com", role: "superadmin" })
        .success,
  },
  {
    description: "accepts valid role update",
    test: () => updateWorkspaceMemberRoleSchema.safeParse({ role: "admin" }).success,
  },
  {
    description: "rejects invalid role in role update",
    test: () => !updateWorkspaceMemberRoleSchema.safeParse({ role: "guest" }).success,
  },
  {
    description: "strictly limits roles to owner, admin, member",
    test: () =>
      ["owner", "admin", "member"].every((r) => workspaceRoleSchema.safeParse(r).success) &&
      !workspaceRoleSchema.safeParse("moderator").success &&
      !workspaceRoleSchema.safeParse("user").success,
  },
  {
    description: "validates valid ObjectId format",
    test: () => objectIdSchema.safeParse(new Types.ObjectId().toHexString()).success,
  },
  {
    description: "rejects invalid ObjectId format",
    test: () => !objectIdSchema.safeParse("invalid-id-123").success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 7. Permission predicates (Task 07)                                         */
/* -------------------------------------------------------------------------- */

section("Workspace permission predicates", [
  {
    description: "isWorkspaceOwner is true only for owner",
    test: () =>
      isWorkspaceOwner("owner") && !isWorkspaceOwner("admin") && !isWorkspaceOwner("member"),
  },
  {
    description: "isWorkspaceAdmin is true for owner and admin, false for member",
    test: () =>
      isWorkspaceAdmin("owner") && isWorkspaceAdmin("admin") && !isWorkspaceAdmin("member"),
  },
  {
    description: "isWorkspaceMember is true for owner, admin, and member",
    test: () =>
      isWorkspaceMember("owner") && isWorkspaceMember("admin") && isWorkspaceMember("member"),
  },
  {
    description: "canManageWorkspaceMembers is true for owner and admin, false for member",
    test: () =>
      canManageWorkspaceMembers("owner") &&
      canManageWorkspaceMembers("admin") &&
      !canManageWorkspaceMembers("member"),
  },
  {
    description: "canEditWorkspace is true for owner and admin, false for member",
    test: () =>
      canEditWorkspace("owner") && canEditWorkspace("admin") && !canEditWorkspace("member"),
  },
]);

/* -------------------------------------------------------------------------- */
/* 8. Role permission rules: Owner (Task 07)                                  */
/* -------------------------------------------------------------------------- */

section("Owner permission rules", [
  {
    description: "Owner can add member with member role",
    test: () => canAddWorkspaceMember("owner", "member"),
  },
  {
    description: "Owner can add member with admin role",
    test: () => canAddWorkspaceMember("owner", "admin"),
  },
  {
    description: "Owner can add member with owner role",
    test: () => canAddWorkspaceMember("owner", "owner"),
  },
  {
    description: "Owner can remove member",
    test: () => canRemoveWorkspaceMember("owner", "member"),
  },
  {
    description: "Owner can remove admin",
    test: () => canRemoveWorkspaceMember("owner", "admin"),
  },
  {
    description: "Owner can change member role to admin or owner",
    test: () =>
      canChangeWorkspaceMemberRole("owner", "member", "admin") &&
      canChangeWorkspaceMemberRole("owner", "member", "owner"),
  },
  {
    description: "Owner cannot remove self if that would leave workspace without an owner",
    test: () => !canRemoveWorkspaceMember("owner", "owner", { totalOwners: 1, isActorSelf: true }),
  },
  {
    description: "Owner can remove another owner if multiple owners exist",
    test: () => canRemoveWorkspaceMember("owner", "owner", { totalOwners: 2, isActorSelf: false }),
  },
  {
    description: "Owner cannot downgrade self if that would leave workspace without an owner",
    test: () =>
      !canChangeWorkspaceMemberRole("owner", "owner", "admin", {
        totalOwners: 1,
        isActorSelf: true,
      }),
  },
  {
    description: "Owner can change role if multiple owners exist",
    test: () =>
      canChangeWorkspaceMemberRole("owner", "owner", "admin", {
        totalOwners: 2,
        isActorSelf: true,
      }),
  },
]);

/* -------------------------------------------------------------------------- */
/* 9. Role permission rules: Admin (Task 07)                                  */
/* -------------------------------------------------------------------------- */

section("Admin permission rules", [
  {
    description: "Admin can add member with role member",
    test: () => canAddWorkspaceMember("admin", "member"),
  },
  {
    description: "Admin can add member with role admin",
    test: () => canAddWorkspaceMember("admin", "admin"),
  },
  {
    description: "Admin cannot promote someone to owner when adding",
    test: () => !canAddWorkspaceMember("admin", "owner"),
  },
  {
    description: "Admin can remove normal member",
    test: () => canRemoveWorkspaceMember("admin", "member"),
  },
  {
    description: "Admin cannot remove owner",
    test: () => !canRemoveWorkspaceMember("admin", "owner"),
  },
  {
    description: "Admin cannot remove another admin",
    test: () => !canRemoveWorkspaceMember("admin", "admin"),
  },
  {
    description: "Admin cannot modify owner role",
    test: () => !canChangeWorkspaceMemberRole("admin", "owner", "member"),
  },
  {
    description: "Admin cannot promote someone to owner",
    test: () => !canChangeWorkspaceMemberRole("admin", "member", "owner"),
  },
  {
    description: "Admin cannot modify another admin's role",
    test: () => !canChangeWorkspaceMemberRole("admin", "admin", "member"),
  },
  {
    description: "Admin can change normal member role to admin",
    test: () => canChangeWorkspaceMemberRole("admin", "member", "admin"),
  },
]);

/* -------------------------------------------------------------------------- */
/* 10. Role permission rules: Member (Task 07)                                */
/* -------------------------------------------------------------------------- */

section("Member permission rules", [
  {
    description: "Member cannot add member",
    test: () => !canAddWorkspaceMember("member", "member"),
  },
  {
    description: "Member cannot remove member",
    test: () => !canRemoveWorkspaceMember("member", "member"),
  },
  {
    description: "Member cannot remove owner",
    test: () => !canRemoveWorkspaceMember("member", "owner"),
  },
  {
    description: "Member cannot change roles",
    test: () =>
      !canChangeWorkspaceMemberRole("member", "member", "admin") &&
      !canChangeWorkspaceMemberRole("member", "admin", "member"),
  },
  {
    description: "Member can view members (is recognized as a valid member)",
    test: () => isWorkspaceMember("member"),
  },
]);

/* -------------------------------------------------------------------------- */
/* 11. Security: Tenancy and IDOR Isolation (Task 07)                         */
/* -------------------------------------------------------------------------- */

const userInWorkspaceA = new Types.ObjectId();
const userInWorkspaceB = new Types.ObjectId();

const workspaceA = {
  members: [
    { userId: userInWorkspaceA, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

const workspaceB = {
  members: [
    { userId: userInWorkspaceB, role: "owner" as const, joinedAt: new Date(), invitedBy: null },
  ],
};

section("Security & Tenancy Isolation (IDOR prevention)", [
  {
    description: "user in Workspace A is recognized as member in Workspace A",
    test: () => findMembership(workspaceA, String(userInWorkspaceA))?.role === "owner",
  },
  {
    description: "user in Workspace A cannot access Workspace B (returns null)",
    test: () => findMembership(workspaceB, String(userInWorkspaceA)) === null,
  },
  {
    description: "user in Workspace B cannot access Workspace A (returns null)",
    test: () => findMembership(workspaceA, String(userInWorkspaceB)) === null,
  },
  {
    description:
      "tampering with workspace ID parameter isolates access and prevents cross-tenant manipulation",
    test: () => {
      // Simulates an API call where User A attempts to target Workspace B
      const callerId = String(userInWorkspaceA);
      const membershipInTargetWorkspace = findMembership(workspaceB, callerId);
      // Because membership is null, requireWorkspaceMember throws 404, preventing IDOR
      return membershipInTargetWorkspace === null;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 12. Run the suite                                                          */
/* -------------------------------------------------------------------------- */

await harness.run();
