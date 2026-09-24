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

---

## Database setup

1. Create a database (local `mongod`, Docker, or MongoDB Atlas).
2. Set `MONGODB_URI` in `.env.local`.
3. Start the app — the connection is created lazily and cached across hot reloads.

Collections: `users`, `workspaces`, `projects`, `issues`, `issue_inputs`, `diagnoses`,
`solution_plans`, `tasks`, `evidence`, `verifications`, `reports`, `notifications`,
`activity_logs`, `ai_runs`.

Indexes are declared on the models (`User.email` unique, workspace/project/issue foreign
keys, `issue.status`, `issue.priority`, `issue.createdAt`, `task.status`, plus text indexes
for search). Large files are never stored in MongoDB — only metadata and storage keys.

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
model. The test runner and suite are added in Phase 9 (Task 39); `npm run verify` keeps
lint, types and the production build honest in the meantime.

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

- Authentication with Auth.js; sessions resolved on the server for every request.
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
| 03  | Configure MongoDB and Mongoose                                 | ⏳ Planned |
| 04  | Implement authentication                                       | ⏳ Planned |
| 05  | User profile and preferences                                   | ⏳ Planned |
| 06  | Workspace creation                                             | ⏳ Planned |
| 07  | Workspace members and roles                                    | ⏳ Planned |
| 08  | Projects                                                       | ⏳ Planned |
| 09  | Dashboard statistics                                           | ⏳ Planned |
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

**Current state:** the foundation and architecture are in place — design system, shared
error/logger/config layers, marketing landing page, and the route skeleton. `/login`,
`/register` and `/dashboard` deliberately render an explicit "planned task" notice instead
of pretending to work; each is replaced by its real implementation in the tasks above.
No screenshots are included because no product UI exists yet.

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
