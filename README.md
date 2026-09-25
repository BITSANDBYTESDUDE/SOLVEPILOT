# SolvePilot

### Your AI Guide from Problem to Solution

**Understand. Solve. Verify.**

SolvePilot is an AI-powered problem resolution workspace. It is not a chatbot: every
problem becomes a structured record that is classified, diagnosed, planned, executed as
tasks, backed with evidence, verified and finally published as a shareable resolution
report.

```
PROBLEM → UNDERSTAND → CLASSIFY → DIAGNOSE → PLAN → ACT → EVIDENCE → VERIFY → RESOLVE → REPORT
```

**Example**

> _“My website navbar is going outside the screen on mobile.”_

SolvePilot returns a titled, categorised, prioritised problem (`Mobile Navbar Overflow`,
UI / Responsive Design, High) with ranked possible causes, a recommended plan
(30–60 minutes), generated tasks, and — once evidence is attached — a verification result
and a professional PDF report.

---

## Features

**Problem intake** — text, screenshot/image, PDF and voice notes; drag-and-drop uploads
with progress, size/type validation and removal; multiple inputs are combined into a
`mixed` source.

**AI assistance (server-side only)** — classification (title, category, priority, summary,
confidence), diagnosis (possible causes with confidence, observations, risks,
assumptions), solution planning (objective, recommendations, ordered steps, effort
estimate), task generation, verification and report narrative. Every AI response is
validated before it is stored, and every call is logged for cost and latency analysis.

**Execution** — task board (todo / in progress / completed / skipped) with assignment,
ordering and status transitions; tasks are independently trackable.

**Evidence** — before / after / supporting evidence with previews, captions, uploader and
timestamp.

**Verification** — manual and AI-assisted verification producing `passed`, `failed` or
`needs_review` with structured checks. A problem cannot be reported as resolved when the
evidence does not support it.

**Reports** — professional PDF resolution reports (problem, diagnosis, plan, completed
tasks, before/after evidence, verification, resolution summary) shared through a
randomly-tokenised public link that exposes only intentionally shared information.

**Workspace** — workspaces, members and roles (owner / admin / member), projects,
activity logging, notifications and search, all enforced server-side.

**AI honesty** — observations, inferences, assumptions and risks are labelled and
confidence is tracked per claim; speculation is never presented as certainty.

---

## Tech Stack

| Layer              | Choice                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| Framework          | Next.js 16 (App Router, React 19, Turbopack) with strict TypeScript                   |
| Styling            | Tailwind CSS v4 with an OKLCH design-token theme, shadcn/ui-style primitives on Radix |
| Forms & validation | React Hook Form + Zod (shared for client and server validation)                       |
| Data (server)      | Next.js route handlers, server actions, server-side service modules                   |
| Data (client)      | TanStack Query for interactive views                                                  |
| Database           | MongoDB with Mongoose                                                                 |
| AI                 | OpenAI API — called exclusively from the server                                       |
| Auth               | Auth.js (session-based), server-enforced authorization                                |
| Storage            | S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Spaces)                   |
| PDF                | Puppeteer (headless Chromium)                                                         |
| Charts             | Recharts (dashboard analytics)                                                        |
| Icons              | Lucide                                                                                |
| Code quality       | ESLint (flat config) + Prettier (with Tailwind class sorting)                         |

---

## Architecture

```
app/            routes, layouts, server actions, route handlers
components/     presentation only (ui, marketing, brand, system, feature modules)
services/       business logic, permissions, workflows
models/         Mongoose schemas, indexes, document types
lib/            config, db, auth, ai, storage, pdf, security, http, errors, utils
validators/     Zod schemas for every external boundary
types/          shared domain + API contracts
tests/          unit, integration and end-to-end tests
```

Layering rules, the API envelope, the AI layer and the security model are documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The short version:

- UI never imports models or the AI provider.
- Business logic lives in `services/`; route handlers stay thin.
- Only `lib/config/env.ts` reads `process.env`.
- Every request is validated with Zod, and every authorization decision is made on the
  server against the workspace the caller actually belongs to.

---

## Project structure

```
solvepilot/
├── app/
│   ├── (auth)/{login,register}
│   ├── dashboard/{issues,projects,reports,activity,settings}
│   ├── share/                    # public, tokenised report links
│   ├── api/                      # route handlers
│   ├── globals.css               # design tokens
│   ├── layout.tsx  page.tsx  error.tsx  loading.tsx  not-found.tsx
├── components/{ui,dashboard,issues,tasks,evidence,verification,reports,ai}
├── components/{marketing,brand,system}
├── lib/{config,db,auth,ai,storage,pdf,security,http,errors,utils,constants}
├── models/  services/  validators/  types/  hooks/  tests/  scripts/  docs/
├── .env.example  components.json  next.config.ts  tsconfig.json
└── ...
```

---

## Environment variables

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

| Variable                                                                                           | Required      | Purpose                                                 |
| -------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| `MONGODB_URI`                                                                                      | yes           | MongoDB connection string.                              |
| `MONGODB_DB_NAME`                                                                                  | no            | Overrides the database name when the URI omits it.      |
| `AUTH_SECRET`                                                                                      | yes           | Session encryption key — `openssl rand -base64 32`.     |
| `AUTH_URL`                                                                                         | yes           | Canonical app URL (OAuth callbacks, share links).       |
| `AUTH_TRUST_HOST`                                                                                  | no            | `true` when running behind a proxy that terminates TLS. |
| `OPENAI_API_KEY`                                                                                   | yes           | Server-side AI calls.                                   |
| `OPENAI_MODEL`                                                                                     | no            | Defaults to `gpt-4o-mini`.                              |
| `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_MS`                                                    | no            | Output and latency guardrails.                          |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` | yes (uploads) | S3-compatible object storage.                           |
| `STORAGE_FORCE_PATH_STYLE`                                                                         | no            | `true` for MinIO and most self-hosted gateways.         |
| `UPLOAD_MAX_IMAGE_BYTES`, `UPLOAD_MAX_DOCUMENT_BYTES`, `UPLOAD_MAX_AUDIO_BYTES`                    | no            | Upload limits (defaults 8 MB / 20 MB / 25 MB).          |
| `PDF_ENABLED`, `PUPPETEER_EXECUTABLE_PATH`                                                         | no            | Report rendering switches.                              |
| `NEXT_PUBLIC_APP_URL`                                                                              | yes           | Absolute base URL for metadata and links.               |
| `NEXT_PUBLIC_APP_NAME`                                                                             | no            | Display name.                                           |
| `LOG_LEVEL`                                                                                        | no            | `debug` / `info` / `warn` / `error`.                    |

Secrets are read only through `lib/config/env.ts`, validated with Zod, and never exposed to
the browser (there is no `NEXT_PUBLIC_` AI or storage variable).

---

## Installation

Requirements: **Node.js ≥ 20.9**, npm, and access to MongoDB (local or Atlas).

```bash
git clone <repository-url> solvepilot
cd solvepilot
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

---

## Development

| Command                                   | Description                                                        |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                             | Start the development server.                                      |
| `npm run build`                           | Production build.                                                  |
| `npm run start`                           | Serve the production build.                                        |
| `npm run typecheck`                       | `tsc --noEmit`.                                                    |
| `npm run lint` / `npm run lint:fix`       | ESLint (flat config).                                              |
| `npm run format` / `npm run format:check` | Prettier with Tailwind class sorting.                              |
| `npm run verify`                          | format:check + lint + typecheck + build — run before opening a PR. |
| `npm run db:verify`                       | Validate every Mongoose schema and ensure database indexes.        |
| `npm run db:indexes`                      | Sync indexes (drops indexes that no longer exist in the schemas).  |

---

## Database setup

1. Create a database (local `mongod`, Docker, or MongoDB Atlas).
2. Set `MONGODB_URI` in `.env.local`.
3. Start the app — the connection is created lazily on first use and cached across hot
   reloads and serverless invocations.
4. Verify the schema and create indexes:

```bash
npm run db:verify             # validate all 15 schemas, ensure indexes, ping the server
npm run db:verify -- --static # schema validation only, never touches a database
npm run db:indexes            # syncIndexes: also drops indexes removed from the schemas
```

Collections and their indexes are declared in `models/` (one file per collection):

| Collection       | Purpose                                           | Key indexes                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`          | accounts, role, preferences                       | `email` (unique), `createdAt`                                                                                                                                                               |
| `workspaces`     | tenancy root + members/roles                      | `slug` (unique), `ownerId`, `members.userId`                                                                                                                                                |
| `projects`       | issue grouping per workspace                      | `workspaceId+status`, `workspaceId+createdAt`, text `name/description`                                                                                                                      |
| `issues`         | the core problem record                           | `workspaceId+status+createdAt`, `workspaceId+priority`, `workspaceId+category`, `workspaceId+assignedTo`, `projectId+createdAt`, `status+createdAt`, `resolvedAt`, text `title/description` |
| `issue_inputs`   | text/image/PDF/audio inputs                       | `issueId+createdAt`, `processingStatus`                                                                                                                                                     |
| `diagnoses`      | summary, causes, observations, risks, assumptions | `issueId+createdAt`                                                                                                                                                                         |
| `solution_plans` | objective, recommendations, ordered steps         | `issueId+createdAt`                                                                                                                                                                         |
| `tasks`          | trackable work items                              | `issueId+order`, `status`, `assignedTo+status`, text `title/description`                                                                                                                    |
| `evidence`       | before/after/supporting proof                     | `issueId+type+createdAt`, `uploadedBy`                                                                                                                                                      |
| `verifications`  | checks with pass/fail/unknown results             | `issueId+createdAt`, `status+createdAt`                                                                                                                                                     |
| `reports`        | PDF reports and share tokens                      | `issueId+createdAt`, `shareToken` (unique, partial)                                                                                                                                         |
| `ai_runs`        | AI usage, tokens and latency                      | `issueId+createdAt`, `type+createdAt`, `status+createdAt`                                                                                                                                   |
| `activity_logs`  | audit trail                                       | `workspaceId+createdAt`, `issueId+createdAt`, `actorId+createdAt`                                                                                                                           |
| `notifications`  | per-user read/unread state                        | `userId+readAt+createdAt`, `userId+createdAt`                                                                                                                                               |
| `sessions`       | revocable sign-in sessions (hashed token)         | `sessionHash` (unique), `userId+createdAt`, `expiresAt`                                                                                                                                     |

Notes:

- Every document is validated against its schema before it reaches the database, and every
  collection stores `createdAt`/`updatedAt` (timestamps) with `__v` disabled.
- Indexes are created automatically in development (`autoIndex`). In production they are
  created by the `db:verify` / `db:indexes` commands as a deployment step.
- Mongoose runs with `sanitizeFilter: true` (query-selector injection protection) and
  `bufferCommands: false` (operations fail fast instead of buffering silently).
- Large files are never stored in MongoDB — only metadata, storage keys and extracted text.
- The scripts above import server-only modules, which is why they run with
  `NODE_OPTIONS=--conditions=react-server` (already wired into the npm scripts).
- `GET /api/health` reports liveness plus whether the database is configured and
  reachable (`ok` / `degraded`). It never exposes host names, database names or error
  details, which makes it safe for load balancers and uptime monitors.
- Next.js loads `.env.local` at boot; restart `npm run dev` after adding or removing a
  variable so the running process picks it up.

---

## Authentication

Email-and-password authentication with **revocable, server-side sessions**.

```bash
npm run auth:verify   # 39 security assertions — hashing, validation, limiter, cookie
```

**How a session works.** Signing in creates a document in `sessions` and returns an opaque
256-bit random id to the browser inside an encrypted, `HttpOnly`, `SameSite=Lax` cookie
(`__Host-` prefixed in production). Only the **SHA-256 hash** of that id is stored, so a
database leak cannot be replayed as a session. Every authenticated request re-reads the
session document, which is what makes logout real: signing out deletes the row, so a captured
cookie stops working immediately instead of lingering until it expires.

- **Absolute expiry** 30 days from sign-in; **idle timeout** 7 days, sliding forward on use.
- At most 10 concurrent sessions per user — the oldest are pruned when a new device signs in.
- `GET /api/auth/sessions` lists the signed-in user's active sessions (metadata and expiry
  only; nothing replayable).

**Passwords** are hashed with bcrypt cost 12. Inputs longer than 72 characters are rejected
rather than silently truncated at bcrypt's boundary. A failed sign-in always answers
`Email or password is incorrect.` and still performs a bcrypt comparison, so neither the
message nor the response timing reveals whether an email is registered. Repeated failures are
throttled per email (5) and per IP (20) over 15 minutes; registration is throttled to 10 per
IP per hour.

| Endpoint             | Method | Result                                                                 |
| -------------------- | ------ | ---------------------------------------------------------------------- |
| `/api/auth/register` | POST   | `201` + session cookie, `409` duplicate email, `400` validation, `429` |
| `/api/auth/login`    | POST   | `200` + session cookie, `401` bad credentials, `429` throttled         |
| `/api/auth/signout`  | POST   | `200`, deletes the session document and expires the cookie             |
| `/api/auth/session`  | GET    | `200` with the user read from the database, or `401`                   |
| `/api/auth/sessions` | GET    | `200` with the caller's active sessions                                |

Every endpoint answers with the canonical `{ success, data }` / `{ success, error }` envelope.

**Server-side gates.** Pages call `requireUser()` (redirects to `/login` with a
same-origin-only `callbackUrl`); route handlers call `requireApiUser()` (throws a `401` the
error envelope renders). Both re-read the user from the database, so a deleted account or a
changed role takes effect on the next request. `/dashboard` is `force-dynamic` — a protected
page must never be prerendered.

`AUTH_SECRET` (`openssl rand -base64 32`) encrypts the cookie; without it sign-in cannot
work. Note that the brute-force limiter is in-process for now: it protects a single instance,
and moves to a shared store in Task 38 (security hardening).

---

## Profile and preferences

`/dashboard/settings` manages the signed-in account. Every endpoint resolves the user from
the session — no request can name another account's id, so there is no path to editing
somebody else's profile (IDOR).

| Endpoint                   | Method | Result                                                                     |
| -------------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/profile`             | GET    | `200` with the profile read from the database                              |
| `/api/profile`             | PATCH  | Update `name` and/or `avatarUrl`; partial updates leave the rest untouched |
| `/api/profile/preferences` | PATCH  | Update `theme` and/or `emailNotifications` independently                   |
| `/api/profile/password`    | POST   | Requires the current password; revokes every _other_ session               |

**Appearance** supports `light`, `dark` and `system`. The choice is applied to the document
immediately and written to `localStorage`, which is what keeps the no-flash bootstrap script
in `lib/theme.ts` correct on the next visit — so the painted theme and the stored preference
cannot drift apart.

**Avatar URLs are restricted to `http`/`https`.** The value ends up in an `<img src>`, so a
`javascript:` or `data:` URL would be an XSS vector; both are rejected by the validator rather
than left to the browser.

**Password changes sign out every other device** while keeping the current session alive, so a
stolen cookie stops working without the change reading as a bug.

The email is shown read-only: changing it is an account-identity operation that needs its own
verification flow and is deliberately not part of this task.

---

## Workspaces

A workspace is the tenancy root: projects, problems and everything under them belong to one.
A user only ever reaches workspaces they are a member of.

| Endpoint                                    | Method | Result                                                        |
| ------------------------------------------- | ------ | ------------------------------------------------------------- |
| `/api/workspaces`                           | GET    | `200` with the caller's workspaces and their role in each     |
| `/api/workspaces`                           | POST   | `201`; the creator becomes its `owner`                        |
| `/api/workspaces/[id]`                      | GET    | `200` for members, `404` for everyone else                    |
| `/api/workspaces/[id]`                      | PATCH  | Rename or change slug; requires `admin` or above              |
| `/api/workspaces/[id]/members`              | GET    | `200` safe member list for workspace members                  |
| `/api/workspaces/[id]/members`              | POST   | `201` adds member by email; requires `admin` or `owner`       |
| `/api/workspaces/[id]/members/[userId]`     | PATCH  | `200` updates member role; owner/admin permission rules       |
| `/api/workspaces/[id]/members/[userId]`     | DELETE | `200` removes member; owner/admin rules, owner protected      |
| `/api/dashboard`                            | GET    | `200` real workspace statistics for caller's active workspace |
| `/api/workspaces/[id]/dashboard`            | GET    | `200` real workspace statistics scoped to target workspace    |
| `/api/workspaces/[id]/projects`             | GET    | `200` lists projects with search, status filter and sort      |
| `/api/workspaces/[id]/projects`             | POST   | `201` creates project; requires `admin` or `owner`            |
| `/api/workspaces/[id]/projects/[projectId]` | GET    | `200` project detail; strictly scoped to workspace            |
| `/api/workspaces/[id]/projects/[projectId]` | PATCH  | `200` updates project or archives; `admin` or `owner`         |
| `/api/workspaces/[id]/projects/[projectId]` | DELETE | `200` permanently deletes project; `admin` or `owner`         |
| `/api/workspaces/active`                    | POST   | Selects the active workspace, after verifying membership      |

**Tenancy is enforced in one place** (`lib/auth/workspace.ts`). Every workspace read goes
through `requireWorkspaceMember()`, so no route can forget the check.

**Non-members get a 404, not a 403.** Answering "forbidden" would confirm the workspace
exists, which would turn the endpoint into a probe for other tenants' ids. A member without
the required role does get a 403 — membership is already established at that point.

**Member management & permissions** (`services/permission.service.ts`, `services/workspace-member.service.ts`):

- `owner`: full workspace control, can add/remove members, update roles, and view all data. Owner cannot be removed or downgraded if doing so leaves the workspace without an owner.
- `admin`: can view members, add members, remove normal members, and promote members to admin. Admin cannot remove an owner, modify owner's role, promote anyone to owner, or remove another admin.
- `member`: view-only access to workspace and member directory. Cannot add, remove, or change roles.
- `IDOR prevention`: all membership operations re-validate caller membership against the target workspace in the database. Cross-workspace ID tampering fails with 404.

**Slugs** are lowercase, hyphenated and unique across the deployment. Omit one and it is
derived from the name; a collision becomes `acme-2`, `acme-3`, and so on. Route-colliding
slugs (`api`, `dashboard`, `login`, `settings`, …) are reserved and rejected.

**Roles** are `owner` > `admin` > `member`, compared through a single rank table so the
service and the UI can never disagree about precedence. The creator's `owner` role is set
server-side and is never read from the request.

The active workspace lives in a non-`httpOnly` cookie so the switcher can update it without a
round trip. It is **not** an authorization credential — membership is re-resolved from the
database on every request, so editing it by hand cannot grant access to anything.

---

## AI setup

1. Create an OpenAI API key and set `OPENAI_API_KEY` in `.env.local`.
2. Optionally adjust `OPENAI_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_MS`.

All AI calls happen server-side through the centralized layer in `lib/ai/`. Each
operation (classification, diagnosis, planning, task generation, verification, report) is
a separate service with its own prompt and Zod schema; responses are validated before they
reach the database, and failures are logged to `ai_runs` with retry support in the UI.

---

## Storage setup

Any S3-compatible provider works. Create a bucket and set `STORAGE_ENDPOINT`,
`STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` and `STORAGE_BUCKET`.
For local development, MinIO is a good fit:

```bash
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

Set `STORAGE_ENDPOINT=http://127.0.0.1:9000` and `STORAGE_FORCE_PATH_STYLE=true`. Buckets
stay private; the application serves short-lived signed URLs.

---

## Testing

Automated tests live in `tests/`:

- `tests/unit` — pure helpers, validators, permission rules.
- `tests/integration` — services against a test database, including workspace isolation.
- `tests/e2e` — the full flow: register → workspace → project → problem → evidence → AI
  classification → diagnosis → plan → tasks → complete tasks → before/after evidence →
  verification → report → open the secure share link.

External AI calls are mocked in deterministic tests so results never depend on a live
model. The test runner and suite are added in Phase 9 (Task 39).

Until then, three assertion scripts cover the behaviour that must not regress. They run
without a database, a browser or a live model:

```bash
npm run verify          # format:check + lint + typecheck + production build
npm run db:verify       # 79 schema, index and serialization checks (15 collections)
npm run auth:verify     # 39 checks: hashing, enumeration-proofing, session ids, cookie
npm run profile:verify  # 26 checks: profile, avatar scheme, preferences, password rules
npm run workspace:verify # 33 checks: slug rules, reserved slugs, roles, membership
```

All three share one harness (`scripts/lib/verify-harness.ts`) and exit non-zero on any
failure, so they are safe to wire into CI.

---

## Deployment

- Set every production variable from the table above; `AUTH_SECRET` must be a fresh
  32-byte random value and `AUTH_URL`/`NEXT_PUBLIC_APP_URL` the real HTTPS origin.
- Use a managed MongoDB (Atlas) and a private S3-compatible bucket.
- `npm run build && npm run start` runs on any Node host; Vercel needs no extra
  configuration. `serverExternalPackages: ["mongoose"]` keeps Mongoose unbundled.
- Puppeteer PDF rendering requires a Chromium binary; set `PUPPETEER_EXECUTABLE_PATH` when
  using a system browser, and give the runtime enough memory for headless Chromium.
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS in production) are set in `next.config.ts`. Framing policy is configured per
  deployment during the Phase 9 hardening task.

---

## Security

- Authentication with Auth.js; the session cookie is an encrypted envelope around an
  opaque id, and the session itself is re-validated against the `sessions` collection on
  every request, so sessions are revocable rather than merely expiring.
- Passwords hashed with bcrypt (cost 12); `passwordHash` is `select: false` and stripped by
  the JSON transform. Failed sign-ins answer identically for unknown emails and wrong
  passwords, and take the same time, so accounts cannot be enumerated.
- Sign-in is throttled per email and per IP; registration per IP.
- Role-based authorization (owner / admin / member) enforced inside services — never in
  the client.
- Workspace isolation: every query is scoped to workspaces the caller belongs to, which
  prevents IDOR-style access to other tenants' records.
- Zod validation on all external input (body, query, params) and on AI output before
  persistence.
- Upload hardening: MIME allow-list, per-type size limits, server-generated storage keys,
  private buckets with signed URLs.
- Public reports use cryptographically random share tokens and expose only intentionally
  shared fields — no emails, internal ids, AI keys or logs.
- Structured server logging with automatic redaction of secrets; users only ever see
  generic messages plus a request id.

---

## Build progress

SolvePilot is built incrementally, and the application stays runnable after every task.

| #   | Task                                                           | Status     |
| --- | -------------------------------------------------------------- | ---------- |
| 01  | Initialize Next.js with TypeScript, Tailwind, ESLint, Prettier | ✅ Done    |
| 02  | Application architecture and folder structure                  | ✅ Done    |
| 03  | Configure MongoDB and Mongoose                                 | ✅ Done    |
| 04  | Implement authentication                                       | ✅ Done    |
| 05  | User profile and preferences                                   | ✅ Done    |
| 06  | Workspace creation                                             | ✅ Done    |
| 07  | Workspace members and roles                                    | ✅ Done    |
| 08  | Projects                                                       | ✅ Done    |
| 09  | Dashboard statistics                                           | ✅ Done    |
| 10  | Activity logging                                               | ⏳ Planned |
| 11  | Issue/problem creation                                         | ⏳ Planned |
| 12  | Issue list with search, filter, sort, pagination               | ⏳ Planned |
| 13  | Issue detail page                                              | ⏳ Planned |
| 14  | Issue status workflow                                          | ⏳ Planned |
| 15  | Secure file uploads                                            | ⏳ Planned |
| 16  | Centralized AI service                                         | ⏳ Planned |
| 17  | AI classification                                              | ⏳ Planned |
| 18  | AI diagnosis                                                   | ⏳ Planned |
| 19  | AI solution planning                                           | ⏳ Planned |
| 20  | AI task generation                                             | ⏳ Planned |
| 21  | AI run logging                                                 | ⏳ Planned |
| 22  | AI retry and error handling                                    | ⏳ Planned |
| 23  | Task board                                                     | ⏳ Planned |
| 24  | Task CRUD                                                      | ⏳ Planned |
| 25  | Drag-and-drop task management                                  | ⏳ Planned |
| 26  | Task assignment                                                | ⏳ Planned |
| 27  | Evidence uploads                                               | ⏳ Planned |
| 28  | Evidence gallery                                               | ⏳ Planned |
| 29  | Evidence metadata                                              | ⏳ Planned |
| 30  | Manual verification engine                                     | ⏳ Planned |
| 31  | AI verification                                                | ⏳ Planned |
| 32  | Verification UI                                                | ⏳ Planned |
| 33  | Report generation service                                      | ⏳ Planned |
| 34  | PDF generation                                                 | ⏳ Planned |
| 35  | Secure public report sharing                                   | ⏳ Planned |
| 36  | Global search                                                  | ⏳ Planned |
| 37  | Notifications                                                  | ⏳ Planned |
| 38  | Security hardening                                             | ⏳ Planned |
| 39  | Unit, integration, API and E2E tests                           | ⏳ Planned |
| 40  | Production readiness, deployment config and documentation      | ⏳ Planned |

**Current state:** the foundation, architecture, database layer, authentication, user
profile and workspaces are in place — design system, shared error/logger/config layers,
marketing landing page, 15 Mongoose models with indexes (`npm run db:verify` → 79/79 schema
checks pass), registration, sign-in and sign-out with revocable server-side sessions
(`npm run auth:verify` → 39/39 checks pass), `/dashboard/settings` for profile, appearance
and password (`npm run profile:verify` → 26/26 checks pass), and multi-workspace tenancy with
a switcher (`npm run workspace:verify` → 33/33 checks pass). The whole `/dashboard` section is
guarded by a single layout, so no page under it can forget its own check. No screenshots are
included because the product UI beyond these screens does not exist yet.

---

## Roadmap

1. **MVP** — authentication, dashboard, problem creation (text + image), AI classification,
   diagnosis, plan, generated tasks, task completion, before/after evidence, verification,
   PDF report.
2. **Next** — PDF input, audio input, teams, notifications, advanced search, analytics,
   public report branding, billing.

Core reliability comes before secondary features.

---

## License

MIT — see [LICENSE](LICENSE).
