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
import { slugify } from "@/lib/utils";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  WORKSPACE_SLUG_MAX_LENGTH,
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
/* 6. Run the suite                                                            */
/* -------------------------------------------------------------------------- */

await harness.run();
