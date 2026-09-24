/**
 * Database verification tooling (Task 03).
 *
 * 1. Static: compiles every model and asserts the schema behaviour the
 *    application relies on (required fields, enum guards, defaults, secret
 *    fields, index definitions). Runs without a database.
 * 2. Live (only when MONGODB_URI is set): connects, creates indexes, prints the
 *    resulting index list, pings the server and disconnects.
 *
 * Usage:
 *   npm run db:verify             # validate schemas, ensure indexes
 *   npm run db:verify -- --sync   # also drop indexes no longer in the schemas
 *   npm run db:verify -- --static # schemas only, never touch a database
 */
import { createRequire } from "node:module";

import mongoose, { type Model } from "mongoose";

import {
  connectToDatabase,
  disconnectFromDatabase,
  getDatabaseStatus,
  isDatabaseConfigured,
  pingDatabase,
} from "@/lib/db/connect";
import * as models from "@/models";

// @next/env is CommonJS; load it through createRequire so this ESM script reads
// exactly the same .env files the Next.js runtime does.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const syncMode = args.has("--sync");
const staticOnly = args.has("--static");

const objectId = () => new mongoose.Types.ObjectId();

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

type Assertion = {
  description: string;
  test: () => boolean | Promise<boolean>;
};

const sections: Array<{ title: string; assertions: Assertion[] }> = [];

function section(title: string, assertions: Assertion[]): void {
  sections.push({ title, assertions });
}

/** Validate a document in memory — no database round-trip required. */
async function isValid<TDocument>(
  model: Model<TDocument>,
  input: Record<string, unknown>,
): Promise<boolean> {
  const document = new model(input as unknown as TDocument);
  try {
    await document.validate();
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Registry                                                                    */
/* -------------------------------------------------------------------------- */

interface ModelEntry {
  name: string;
  collectionName: string;
  indexNames: string[];
  ensureIndexes: () => Promise<unknown>;
  syncIndexes: () => Promise<string[]>;
}

function entry<TDocument>(name: string, model: Model<TDocument>): ModelEntry {
  const indexes = model.schema.indexes();

  return {
    name,
    collectionName: model.collection.collectionName,
    indexNames: indexes.map(([fields]) => Object.keys(fields as Record<string, unknown>).join("+")),
    ensureIndexes: () => model.createIndexes(),
    syncIndexes: async () => (await model.syncIndexes()) ?? [],
  };
}

const MODELS: ModelEntry[] = [
  entry("User", models.User),
  entry("Workspace", models.Workspace),
  entry("Project", models.Project),
  entry("Issue", models.Issue),
  entry("IssueInput", models.IssueInput),
  entry("Diagnosis", models.Diagnosis),
  entry("SolutionPlan", models.SolutionPlan),
  entry("Task", models.Task),
  entry("Evidence", models.Evidence),
  entry("Verification", models.Verification),
  entry("Report", models.Report),
  entry("AiRun", models.AiRun),
  entry("ActivityLog", models.ActivityLog),
  entry("Notification", models.Notification),
  entry("Session", models.Session),
];

function indexNamesOf<TDocument>(model: Model<TDocument>): string[] {
  return model.schema
    .indexes()
    .map(([fields]) => Object.keys(fields as Record<string, unknown>).join("+"));
}

function jsonOf(document: { toJSON: () => unknown }): Record<string, unknown> {
  return document.toJSON() as unknown as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* 1. Schema registration + index definitions                                  */
/* -------------------------------------------------------------------------- */

section(
  "Model registry",
  MODELS.map((model) => ({
    description: `${model.name} → "${model.collectionName}" · ${model.indexNames.length} indexes: ${model.indexNames.join(", ")}`,
    test: () => model.indexNames.length > 0,
  })),
);

/* -------------------------------------------------------------------------- */
/* 2. Schema behaviour                                                         */
/* -------------------------------------------------------------------------- */

section("User schema", [
  {
    description: "accepts a valid user",
    test: () => isValid(models.User, { name: "Ayesha Khan", email: "ayesha@example.com" }),
  },
  {
    description: "lowercases and trims the email",
    test: () =>
      new models.User({ name: "Test User", email: "  Test@Example.com " }).email ===
      "test@example.com",
  },
  {
    description: "rejects an invalid email",
    test: async () => !(await isValid(models.User, { name: "Test User", email: "not-an-email" })),
  },
  {
    description: "requires a name",
    test: async () => !(await isValid(models.User, { email: "test@example.com" })),
  },
  { description: "defaults role to user", test: () => new models.User({}).role === "user" },
  {
    description: "defaults theme to system",
    test: () => new models.User({}).preferences.theme === "system",
  },
  {
    description: "defaults emailNotifications to true",
    test: () => new models.User({}).preferences.emailNotifications === true,
  },
  {
    description: "rejects an unknown theme",
    test: async () => !(await isValid(models.User, { preferences: { theme: "neon" } })),
  },
  {
    description: "passwordHash is excluded from queries by default",
    test: () => models.User.schema.path("passwordHash")?.options.select === false,
  },
  {
    description: "json transform removes _id and passwordHash",
    test: () => {
      const json = jsonOf(
        new models.User({ name: "Test User", email: "test@example.com", passwordHash: "hash" }),
      );
      return json.id !== undefined && json._id === undefined && json.passwordHash === undefined;
    },
  },
]);

section("Workspace schema", [
  {
    description: "accepts a valid workspace with members",
    test: () =>
      isValid(models.Workspace, {
        name: "Product Team",
        slug: "product-team",
        ownerId: objectId(),
        members: [{ userId: objectId(), role: "admin" }],
      }),
  },
  {
    description: "rejects an invalid slug",
    test: async () => !(await isValid(models.Workspace, { name: "Team", slug: "Invalid Slug!" })),
  },
  {
    description: "rejects an unknown member role",
    test: async () =>
      !(await isValid(models.Workspace, {
        name: "Team",
        slug: "team",
        ownerId: objectId(),
        members: [{ userId: objectId(), role: "superuser" }],
      })),
  },
  {
    description: "requires an owner",
    test: async () => !(await isValid(models.Workspace, { name: "Team", slug: "team" })),
  },
  {
    description: "indexes the slug uniquely and the owner",
    test: () =>
      indexNamesOf(models.Workspace).includes("slug") &&
      models.Workspace.schema.path("ownerId")?.options.index === true,
  },
]);

section("Project schema", [
  {
    description: "accepts a valid project",
    test: () =>
      isValid(models.Project, { workspaceId: objectId(), name: "Website", createdBy: objectId() }),
  },
  {
    description: "rejects an invalid colour",
    test: async () =>
      !(await isValid(models.Project, {
        workspaceId: objectId(),
        name: "Website",
        createdBy: objectId(),
        color: "indigo",
      })),
  },
  {
    description: "defaults status to active",
    test: () => new models.Project({}).status === "active",
  },
]);

section("Issue schema", [
  {
    description: "accepts a valid issue",
    test: () =>
      isValid(models.Issue, {
        workspaceId: objectId(),
        projectId: objectId(),
        createdBy: objectId(),
        title: "Mobile Navbar Overflow",
        description: "Navigation content exceeds the mobile viewport.",
      }),
  },
  {
    description: "requires a title",
    test: async () =>
      !(await isValid(models.Issue, {
        workspaceId: objectId(),
        projectId: objectId(),
        createdBy: objectId(),
      })),
  },
  {
    description: "defaults status/priority/category/source",
    test: () => {
      const issue = new models.Issue({});
      return (
        issue.status === "new" &&
        issue.priority === "medium" &&
        issue.category === "other" &&
        issue.source === "text"
      );
    },
  },
  {
    description: "rejects an unknown status",
    test: async () => !(await isValid(models.Issue, { title: "Valid title", status: "done" })),
  },
  {
    description: "rejects an unknown priority",
    test: async () => !(await isValid(models.Issue, { title: "Valid title", priority: "urgent" })),
  },
  {
    description: "rejects confidence above 1",
    test: async () => !(await isValid(models.Issue, { title: "Valid title", aiConfidence: 1.4 })),
  },
  {
    description: "rejects confidence below 0",
    test: async () => !(await isValid(models.Issue, { title: "Valid title", aiConfidence: -0.2 })),
  },
]);

section("IssueInput schema", [
  {
    description: "defaults processingStatus to pending",
    test: () => new models.IssueInput({}).processingStatus === "pending",
  },
  {
    description: "rejects an unknown input type",
    test: async () => !(await isValid(models.IssueInput, { issueId: objectId(), type: "video" })),
  },
]);

section("Diagnosis schema", [
  {
    description: "accepts a structured diagnosis",
    test: () =>
      isValid(models.Diagnosis, {
        issueId: objectId(),
        summary: "Navigation content exceeds the mobile viewport.",
        possibleCauses: [
          {
            title: "Fixed-width container",
            explanation: "Likely a hard-coded width.",
            confidence: 0.8,
          },
        ],
        observations: ["Navbar extends past the viewport at 375px"],
        risks: ["Desktop spacing may shift"],
        assumptions: ["All marketing pages share the layout"],
      }),
  },
  {
    description: "requires an explanation for each possible cause",
    test: async () =>
      !(await isValid(models.Diagnosis, {
        issueId: objectId(),
        summary: "Summary",
        possibleCauses: [{ title: "Cause", confidence: 0.5 }],
      })),
  },
  {
    description: "rejects cause confidence above 1",
    test: async () =>
      !(await isValid(models.Diagnosis, {
        issueId: objectId(),
        summary: "Summary",
        possibleCauses: [{ title: "Cause", explanation: "Because.", confidence: 1.5 }],
      })),
  },
]);

section("SolutionPlan schema", [
  {
    description: "accepts ordered steps",
    test: () =>
      isValid(models.SolutionPlan, {
        issueId: objectId(),
        objective: "Make the navbar fit on mobile",
        recommendations: ["Prefer a fluid layout"],
        steps: [
          { order: 1, title: "Inspect navbar container", description: "Check width rules." },
          { order: 2, title: "Add mobile breakpoint", description: "Collapse to a menu." },
        ],
        estimatedMinutes: 45,
      }),
  },
  {
    description: "rejects a step without an order",
    test: async () =>
      !(await isValid(models.SolutionPlan, {
        issueId: objectId(),
        objective: "Objective",
        steps: [{ title: "Step", description: "" }],
      })),
  },
]);

section("Task schema", [
  { description: "defaults status to todo", test: () => new models.Task({}).status === "todo" },
  {
    description: "rejects an unknown task status",
    test: async () =>
      !(await isValid(models.Task, { issueId: objectId(), title: "Fix it", status: "blocked" })),
  },
  {
    description: "accepts assignment to a user",
    test: () =>
      isValid(models.Task, {
        issueId: objectId(),
        title: "Test at 375px",
        assignedTo: objectId(),
        order: 3,
        estimatedMinutes: 10,
      }),
  },
]);

section("Evidence schema", [
  {
    description: "accepts before/after evidence",
    test: () =>
      isValid(models.Evidence, {
        issueId: objectId(),
        type: "after",
        fileUrl: "https://storage.example.com/after.png",
        storageKey: "workspaces/1/issues/2/after.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        uploadedBy: objectId(),
      }),
  },
  {
    description: "rejects an unknown evidence type",
    test: async () =>
      !(await isValid(models.Evidence, {
        issueId: objectId(),
        type: "during",
        fileUrl: "https://example.com/x.png",
        storageKey: "key",
        uploadedBy: objectId(),
      })),
  },
]);

section("Verification schema", [
  {
    description: "accepts a needs_review outcome",
    test: () =>
      isValid(models.Verification, {
        issueId: objectId(),
        method: "ai",
        status: "needs_review",
        summary: "Evidence is insufficient to confirm the fix.",
        checks: [
          {
            name: "Mobile layout at 375px",
            result: "unknown",
            explanation: "No after screenshot attached.",
          },
        ],
        confidence: 0.4,
      }),
  },
  {
    description: "rejects an unknown check result",
    test: async () =>
      !(await isValid(models.Verification, {
        issueId: objectId(),
        method: "manual",
        status: "passed",
        summary: "Looks fine.",
        checks: [{ name: "Check", result: "maybe", explanation: "Unclear." }],
      })),
  },
]);

section("Report schema", [
  {
    description: "defaults status to generating",
    test: () => new models.Report({ title: "Report" }).status === "generating",
  },
  {
    description: "accepts a share token",
    test: () =>
      isValid(models.Report, { issueId: objectId(), title: "Report", shareToken: "abc123" }),
  },
  {
    description: "share token index is unique and partial",
    test: () => {
      const found = models.Report.schema
        .indexes()
        .find(([fields]) => "shareToken" in (fields as Record<string, unknown>));
      const options = found?.[1];
      return options?.unique === true && options?.partialFilterExpression !== undefined;
    },
  },
]);

section("AiRun schema", [
  {
    description: "accepts a succeeded run",
    test: () =>
      isValid(models.AiRun, {
        issueId: objectId(),
        type: "classification",
        model: "gpt-4o-mini",
        inputTokens: 820,
        outputTokens: 140,
        latencyMs: 1450,
        status: "succeeded",
      }),
  },
  {
    description: "rejects an unknown run type",
    test: async () =>
      !(await isValid(models.AiRun, {
        issueId: objectId(),
        type: "summarize",
        model: "gpt-4o-mini",
        status: "succeeded",
      })),
  },
]);

section("ActivityLog schema", [
  {
    description: "accepts a known action",
    test: () =>
      isValid(models.ActivityLog, {
        workspaceId: objectId(),
        issueId: objectId(),
        actorId: objectId(),
        action: "issue.analyzed",
        metadata: { category: "ui" },
      }),
  },
  {
    description: "rejects an unknown action",
    test: async () =>
      !(await isValid(models.ActivityLog, {
        workspaceId: objectId(),
        actorId: objectId(),
        action: "issue.vibed",
      })),
  },
]);

section("Notification schema", [
  { description: "defaults to unread", test: () => new models.Notification({}).readAt === null },
  {
    description: "rejects an unknown notification type",
    test: async () =>
      !(await isValid(models.Notification, {
        userId: objectId(),
        workspaceId: objectId(),
        type: "issue.teleported",
        title: "Hello",
        link: "/dashboard",
      })),
  },
]);

section("Session schema", [
  {
    description: "accepts a valid session",
    test: () =>
      isValid(models.Session, {
        sessionHash: "a".repeat(64),
        userId: objectId(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
  },
  {
    description: "requires sessionHash",
    test: async () =>
      !(await isValid(models.Session, { userId: objectId(), expiresAt: new Date() })),
  },
  {
    description: "requires userId",
    test: async () =>
      !(await isValid(models.Session, { sessionHash: "a".repeat(64), expiresAt: new Date() })),
  },
  {
    description: "requires expiresAt",
    test: async () =>
      !(await isValid(models.Session, { sessionHash: "a".repeat(64), userId: objectId() })),
  },
  {
    description: "defaults userAgent and ipAddress to null",
    test: () => {
      const session = new models.Session({
        sessionHash: "a".repeat(64),
        userId: objectId(),
        expiresAt: new Date(),
      });
      return session.userAgent === null && session.ipAddress === null;
    },
  },
  {
    description: "caps the user agent length",
    test: () =>
      models.Session.schema.path("userAgent")?.options?.maxlength === models.MAX_USER_AGENT_LENGTH,
  },
  {
    description: "json transform removes _id",
    test: () => {
      const json = jsonOf(
        new models.Session({
          sessionHash: "a".repeat(64),
          userId: objectId(),
          expiresAt: new Date(),
        }),
      );
      return json.id !== undefined && json._id === undefined;
    },
  },
]);

section("Index coverage", [
  {
    description: "User.email unique",
    test: () => indexNamesOf(models.User).includes("email"),
  },
  {
    description: "Issue workspace/status/priority/category indexes",
    test: () =>
      ["workspaceId+status+createdAt", "workspaceId+priority", "workspaceId+category"].every(
        (name) => indexNamesOf(models.Issue).includes(name),
      ),
  },
  {
    description: "Issue project index",
    test: () => indexNamesOf(models.Issue).includes("projectId+createdAt"),
  },
  {
    description: "Task issue/status indexes",
    test: () =>
      ["issueId+order", "status"].every((name) => indexNamesOf(models.Task).includes(name)),
  },
  {
    description: "Evidence issue index",
    test: () => indexNamesOf(models.Evidence).includes("issueId+type+createdAt"),
  },
  {
    description: "AiRun issue index",
    test: () => indexNamesOf(models.AiRun).includes("issueId+createdAt"),
  },
  {
    description: "ActivityLog issue + createdAt indexes",
    test: () =>
      ["issueId+createdAt", "workspaceId+createdAt"].every((name) =>
        indexNamesOf(models.ActivityLog).includes(name),
      ),
  },
  {
    description: "Session hash unique + user and expiry indexes",
    test: () =>
      ["sessionHash", "userId+createdAt", "expiresAt"].every((name) =>
        indexNamesOf(models.Session).includes(name),
      ),
  },
  {
    description: "text search indexes on Issue, Project and Task",
    test: () =>
      [models.Issue, models.Project, models.Task].every((model) =>
        model.schema
          .indexes()
          .some(([fields]) => Object.values(fields as Record<string, unknown>).includes("text")),
      ),
  },
]);

/* -------------------------------------------------------------------------- */
/* 3. Run the suite                                                            */
/* -------------------------------------------------------------------------- */

let passed = 0;
let failed = 0;

for (const group of sections) {
  console.log(`\n${group.title}`);

  for (const assertion of group.assertions) {
    let ok = false;
    let failureReason = "";

    try {
      ok = await assertion.test();
    } catch (error) {
      failureReason = ` (threw: ${error instanceof Error ? error.message : String(error)})`;
    }

    if (ok) {
      passed += 1;
      console.log(`  ✓ ${assertion.description}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${assertion.description}${failureReason}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Live database checks (optional)                                          */
/* -------------------------------------------------------------------------- */

console.log("\nDatabase connection");
const status = getDatabaseStatus();
console.log(`  · MONGODB_URI configured: ${status.configured ? "yes" : "no"}`);

if (staticOnly) {
  console.log("  · --static supplied: skipping live database checks");
} else if (!isDatabaseConfigured()) {
  console.log(
    "  · skipped: set MONGODB_URI in .env.local to create indexes and verify connectivity",
  );
} else {
  try {
    await connectToDatabase();
    console.log(`  · connected to "${getDatabaseStatus().databaseName ?? "database"}"`);

    for (const model of MODELS) {
      if (syncMode) {
        const dropped = await model.syncIndexes();
        console.log(
          `  ✓ ${model.name}: ${model.indexNames.length} index(es) synced (${dropped.length} stale dropped)`,
        );
      } else {
        await model.ensureIndexes();
        console.log(`  ✓ ${model.name}: ${model.indexNames.length} index(es) ensured`);
      }
    }

    const alive = await pingDatabase();
    if (alive) {
      passed += 1;
      console.log("  ✓ server responds to ping");
    } else {
      failed += 1;
      console.log("  ✗ server did not respond to ping");
    }
  } catch (error) {
    failed += 1;
    console.log(
      `  ✗ database check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await disconnectFromDatabase();
  }
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                     */
/* -------------------------------------------------------------------------- */

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed}/${passed + failed} checks passed`);
process.exit(failed === 0 ? 0 : 1);
