/**
 * Profile and preference verification tooling (Task 05).
 *
 * Asserts the validation rules the settings screen depends on, without needing
 * a database or the Next.js runtime. The security-relevant ones are the avatar
 * URL scheme checks (a `javascript:` URL would be an XSS vector once rendered
 * in an `<img src>`) and the password-change rules.
 *
 * Usage:  npm run profile:verify
 */
import { createRequire } from "node:module";

import {
  changePasswordSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "@/validators/profile";
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
/* 1. Profile                                                                  */
/* -------------------------------------------------------------------------- */

section("Profile updates", [
  {
    description: "accepts a valid name",
    test: () => updateProfileSchema.safeParse({ name: "Ayesha Khan" }).success,
  },
  {
    description: "trims surrounding whitespace from the name",
    test: () => updateProfileSchema.parse({ name: "  Ayesha Khan  " }).name === "Ayesha Khan",
  },
  {
    description: "rejects a name shorter than 2 characters",
    test: () => !updateProfileSchema.safeParse({ name: "A" }).success,
  },
  {
    description: "rejects a name longer than 80 characters",
    test: () => !updateProfileSchema.safeParse({ name: "a".repeat(81) }).success,
  },
  {
    description: "rejects an update with no fields at all",
    test: () => !updateProfileSchema.safeParse({}).success,
  },
]);

section("Avatar URL scheme is restricted", [
  {
    description: "accepts an https URL",
    test: () =>
      updateProfileSchema.safeParse({ avatarUrl: "https://cdn.example.com/a.png" }).success,
  },
  {
    description: "accepts an http URL",
    test: () =>
      updateProfileSchema.safeParse({ avatarUrl: "http://cdn.example.com/a.png" }).success,
  },
  {
    description: "rejects a javascript: URL (XSS)",
    test: () => !updateProfileSchema.safeParse({ avatarUrl: "javascript:alert(1)" }).success,
  },
  {
    description: "rejects a javascript: URL disguised with whitespace",
    test: () => !updateProfileSchema.safeParse({ avatarUrl: "  javascript:alert(1)" }).success,
  },
  {
    description: "rejects a data: URL",
    test: () =>
      !updateProfileSchema.safeParse({ avatarUrl: "data:text/html,<script>alert(1)</script>" })
        .success,
  },
  {
    description: "rejects a relative URL",
    test: () => !updateProfileSchema.safeParse({ avatarUrl: "/images/avatar.png" }).success,
  },
  {
    description: "rejects a URL over 2048 characters",
    test: () =>
      !updateProfileSchema.safeParse({ avatarUrl: `https://x.example/${"a".repeat(2100)}` })
        .success,
  },
  {
    description: "an empty avatar field means remove it (null)",
    test: () => updateProfileSchema.parse({ avatarUrl: "" }).avatarUrl === null,
  },
]);

/* -------------------------------------------------------------------------- */
/* 2. Preferences                                                              */
/* -------------------------------------------------------------------------- */

section("Preferences", [
  {
    description: "accepts light, dark and system",
    test: () =>
      ["light", "dark", "system"].every(
        (theme) => updatePreferencesSchema.safeParse({ theme }).success,
      ),
  },
  {
    description: "rejects an unknown theme",
    test: () => !updatePreferencesSchema.safeParse({ theme: "neon" }).success,
  },
  {
    description: "allows a partial update — theme alone is valid",
    test: () => updatePreferencesSchema.safeParse({ theme: "dark" }).success,
  },
  {
    description: 'coerces true, "true" and "on" to boolean true',
    test: () =>
      [true, "true", "on"].every(
        (value) =>
          updatePreferencesSchema.parse({ emailNotifications: value }).emailNotifications === true,
      ),
  },
  {
    description: 'coerces false and "false" to boolean false',
    test: () =>
      [false, "false"].every(
        (value) =>
          updatePreferencesSchema.parse({ emailNotifications: value }).emailNotifications === false,
      ),
  },
  {
    description: "an empty preferences update parses but carries no fields",
    test: () => {
      const parsed = updatePreferencesSchema.parse({});
      return parsed.theme === undefined && parsed.emailNotifications === undefined;
    },
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Password change                                                          */
/* -------------------------------------------------------------------------- */

const validChange = {
  currentPassword: "currentpassword",
  newPassword: "brandnewpassword",
  confirmPassword: "brandnewpassword",
};

section("Password change", [
  {
    description: "accepts a valid change",
    test: () => changePasswordSchema.safeParse(validChange).success,
  },
  {
    description: "rejects a missing current password",
    test: () => !changePasswordSchema.safeParse({ ...validChange, currentPassword: "" }).success,
  },
  {
    description: "rejects a new password shorter than 8 characters",
    test: () =>
      !changePasswordSchema.safeParse({
        ...validChange,
        newPassword: "short",
        confirmPassword: "short",
      }).success,
  },
  {
    description: "rejects a new password over 72 characters",
    test: () => {
      const long = "a".repeat(73);
      return !changePasswordSchema.safeParse({
        ...validChange,
        newPassword: long,
        confirmPassword: long,
      }).success;
    },
  },
  {
    description: "rejects a mismatched confirmation",
    test: () =>
      !changePasswordSchema.safeParse({ ...validChange, confirmPassword: "different" }).success,
  },
  {
    description: "reports the mismatch on the confirmPassword field",
    test: () => {
      const result = changePasswordSchema.safeParse({
        ...validChange,
        confirmPassword: "x".repeat(12),
      });
      return (
        !result.success && result.error.issues.some((issue) => issue.path[0] === "confirmPassword")
      );
    },
  },
  {
    description: "rejects reusing the current password",
    test: () =>
      !changePasswordSchema.safeParse({
        currentPassword: "samepassword",
        newPassword: "samepassword",
        confirmPassword: "samepassword",
      }).success,
  },
]);

/* -------------------------------------------------------------------------- */
/* 4. Run the suite                                                            */
/* -------------------------------------------------------------------------- */

await harness.run();
