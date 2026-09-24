# SolvePilot — Architecture

This document describes how the codebase is organised and the rules that keep it
maintainable as modules are added task by task.

SolvePilot is a single Next.js (App Router) application. There is intentionally **no
separate Express server** for the MVP: route handlers, server actions and server-side
services cover the backend, and service modules are written so they can be extracted
into a standalone service later without touching the UI.

---

## 1. Layering

```
┌──────────────────────────────────────────────────────────────────┐
│ app/            routes, layouts, server actions, route handlers  │
├──────────────────────────────────────────────────────────────────┤
│ components/     presentation only — no database or AI imports    │
├──────────────────────────────────────────────────────────────────┤
│ services/       business logic: permissions, workflows, use cases│
├──────────────────────────────────────────────────────────────────┤
│ models/         Mongoose schemas, indexes, document types        │
│ lib/ai/         AI providers + task-specific AI services         │
│ lib/storage/    S3-compatible object storage adapter             │
│ lib/pdf/        Puppeteer report renderer                        │
├──────────────────────────────────────────────────────────────────┤
│ lib/db, lib/auth, lib/security, lib/config, lib/http, lib/errors │
└──────────────────────────────────────────────────────────────────┘
```

Hard rules:

1. **UI never touches the database or the AI provider.** Components receive plain
   props; data arrives from server components, route handlers or server actions.
2. **Business logic lives in `services/`.** Route handlers parse/validate input,
   call a service, translate the result into the response envelope.
3. **Models never import services.** Dependencies point inwards (services → models).
4. **Only `lib/ai/*` may call the AI provider**, and only with a server-side key.
   The browser must never receive an API key (there is no `NEXT_PUBLIC_` AI variable).
5. **Authorization is enforced in services**, using the session resolved on the
   server. Client-side checks are treated as cosmetics.
6. **All external input is validated with Zod** (`validators/`), including AI output
   before it is persisted.

---

## 2. Directory map

| Path                    | Responsibility                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                  | Routes. `(auth)` group for credential screens, `dashboard/` for the workspace, `share/` for public reports, `api/` for route handlers.                                                                                                                                  |
| `app/api/`              | HTTP surface. Thin handlers only: validate → service → envelope (`lib/http/api-response.ts`).                                                                                                                                                                           |
| `components/ui/`        | Design-system primitives (Button, Card, Badge, Alert, EmptyState, …).                                                                                                                                                                                                   |
| `components/dashboard   | issues                                                                                                                                                                                                                                                                  | tasks | evidence | verification | reports | ai` | Feature-scoped components, arranged by domain module. |
| `components/marketing/` | Landing-page sections.                                                                                                                                                                                                                                                  |
| `components/brand/`     | Logo and brand marks.                                                                                                                                                                                                                                                   |
| `components/system/`    | Cross-cutting UI (build-stage notices, error/empty screens).                                                                                                                                                                                                            |
| `lib/config/`           | The only place that reads `process.env`; Zod-validated.                                                                                                                                                                                                                 |
| `lib/db/`               | Mongoose connection management (cached across hot reloads), status and ping helpers.                                                                                                                                                                                    |
| `lib/auth/`             | Session service (create/lookup/revoke/prune), bcrypt helpers, the session cookie codec, and server-side gates (`requireUser`, `requireApiUser`).                                                                                                                        |
| `lib/ai/`               | Central AI layer: client wrapper, prompts, JSON parsing/validation, per-operation services.                                                                                                                                                                             |
| `lib/storage/`          | Object-storage adapter, signed URLs, upload key strategy.                                                                                                                                                                                                               |
| `lib/pdf/`              | Report HTML template + Puppeteer renderer.                                                                                                                                                                                                                              |
| `lib/security/`         | Rate limiting, upload validation, share tokens, MIME rules.                                                                                                                                                                                                             |
| `lib/http/`             | Response envelope helpers and request helpers.                                                                                                                                                                                                                          |
| `lib/errors/`           | Typed application errors and normalization to HTTP-safe errors.                                                                                                                                                                                                         |
| `lib/logger.ts`         | Structured server logging with secret redaction.                                                                                                                                                                                                                        |
| `lib/utils/`            | Pure, framework-free helpers (class merging, formatting).                                                                                                                                                                                                               |
| `lib/constants/`        | Domain labels/tones and the lifecycle definition.                                                                                                                                                                                                                       |
| `models/`               | One file per collection (users, workspaces, projects, issues, issue_inputs, diagnoses, solution_plans, tasks, evidence, verifications, reports, ai_runs, activity_logs, notifications), plus `schema-options.ts` for shared conventions and `index.ts` as the registry. |
| `services/`             | Business logic: issue, ai orchestration, diagnosis, planning, task, verification, report, upload.                                                                                                                                                                       |
| `validators/`           | Zod schemas for every external boundary and every stored AI artefact.                                                                                                                                                                                                   |
| `types/`                | Shared TypeScript contracts (`types/domain.ts`, `types/api.ts`).                                                                                                                                                                                                        |
| `hooks/`                | Client hooks.                                                                                                                                                                                                                                                           |
| `tests/`                | `unit/`, `integration/`, `e2e/`.                                                                                                                                                                                                                                        |
| `scripts/`              | Operational scripts (index sync, seed tooling for tests, PDF smoke check).                                                                                                                                                                                              |
| `docs/`                 | Architecture and operational documentation.                                                                                                                                                                                                                             |

`utils/` from the original specification is intentionally folded into `lib/utils/` so
there is exactly one home for framework-free helpers.

---

## 3. Request flow

```
Browser (RSC / client component)
        │  fetch / server action
        ▼
app/api/…/route.ts  ──validate──▶  validators/*.ts (Zod)
        │
        ▼
services/*.service.ts ──▶ lib/auth (session + workspace role check)
        │                 ──▶ models/* (Mongoose, workspace-scoped)
        │                 ──▶ lib/ai/* (server-side AI operations)
        │                 ──▶ lib/storage/* (uploads, signed URLs)
        ▼
lib/http/api-response.ts ──▶ { success, data } | { success, error }
```

Errors thrown anywhere in the chain are normalized by `lib/errors` into an `AppError`
with an HTTP status and a stable code. Unexpected errors are logged with full context
and returned as a generic 500 with a request id — never as an internal stack trace.

---

## 4. Database layer

`lib/db/connect.ts` is the only module that talks to Mongoose's connection:

- **Lazy + cached**: the connection is opened on first use and cached on `globalThis`, so
  hot reloads and serverless invocations reuse one pool instead of opening a connection per
  module evaluation. Concurrent callers share the in-flight promise.
- **Fail fast**: `bufferCommands` is off — operations never hang waiting for a connection,
  they throw. Services always `await connectToDatabase()` first.
- **Injection safe**: `sanitizeFilter` wraps plain filter values in `$eq`, so a crafted
  object can never be interpreted as a query operator.
- **Observable**: connect/reconnect/lost/error events are logged through `lib/logger`;
  `getDatabaseStatus()` and `pingDatabase()` support diagnostics and health checks.
- **Configurable**: `MONGODB_URI`/`MONGODB_DB_NAME` come from `lib/config/env.ts`; a missing
  URI raises an actionable error instead of a confusing driver failure.

Schema conventions (`models/schema-options.ts`):

- `timestamps: true` (createdAt/updatedAt), `versionKey: false` (no `__v`), `minimize: false`.
- A shared `toJSON`/`toObject` transform converts `_id` to `id` and strips `passwordHash`.
- `registeredModel()` reuses an existing compiled model, which keeps hot reload and
  serverless runtimes free of `OverwriteModelError`.
- Enums are imported from `types/domain.ts` (single source of truth shared with validators
  and UI labels), never re-typed in the schema.
- Indexes are declared per model next to the fields they serve. Where a compound index
  already covers a single-field access path (index prefix rule), no redundant single-field
  index is added.

Operational tooling: `scripts/db-verify.mts` (`npm run db:verify`) compiles every model,
runs 70 schema assertions without a database, and — when `MONGODB_URI` is present —
connects, creates/syncs indexes, reports them and pings the server.

---

## 5. API contract

```jsonc
// success
{ "success": true, "data": { /* resource or { items, meta } for lists */ } }

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {}, "requestId": "…" } }
```

Status codes: `400` validation, `401` unauthenticated, `403` unauthorized,
`404` not found, `409` conflict, `413` payload too large, `415` unsupported media,
`422` unprocessable (e.g. failed AI output validation), `429` rate limited,
`500` internal, `502` upstream (AI/storage) failure.

List endpoints return `{ items, meta: { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage } }`.

---

## 6. AI layer

- `lib/ai/client.ts` — single provider wrapper (timeouts, retries, token accounting).
- `lib/ai/services/*` — one service per operation: classification, diagnosis, planning,
  task generation, verification, report narrative.
- `lib/ai/schemas.ts` — Zod schemas that every AI response is parsed with.
- `models/ai-run.model.ts` — every call is logged (type, model, tokens, latency,
  status, error) for debugging, monitoring and cost analysis.

Prompting rules: structured JSON output, explicit confidence per claim, and a hard
separation between observation, inference, assumption and recommendation. Verification
may return `needs_review` rather than claiming a resolution.

---

## 7. Security model

| Concern         | Control                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication  | Auth.js cookie (encrypted JWE) wrapping an opaque id; the session of record lives in `sessions` and is re-validated on every request, so sessions are revocable. bcrypt cost 12; `AUTH_SECRET` required. |
| Sessions        | Hashed session id (SHA-256) only, 30-day absolute expiry, 7-day sliding idle timeout, 10 per user.                                                                                                       |
| Credential flow | Enumeration-proof error messages and matching response timing; throttled per email, per IP and per registration IP.                                                                                      |
| Authorization   | Workspace role checks (owner/admin/member) inside services for every resource.                                                                                                                           |
| Profile         | Endpoints resolve the user from the session, never from a request parameter, so another account's id cannot be supplied (IDOR).                                                                          |
| Password change | Requires the current password and revokes every other session, keeping only the session that made the change.                                                                                            |
| Avatar URLs     | Restricted to http/https by validation — rendered in `<img src>`, so `javascript:`/`data:` schemes are rejected.                                                                                         |
| Tenancy         | All queries scoped by `workspaceId`; membership resolved from the session.                                                                                                                               |
| Workspace 404s  | A non-member receives 404 rather than 403, so the endpoint cannot be used to probe which workspace ids exist. Members without the required role get 403.                                                 |
| Uploads         | MIME + size validation, content sniffing where practical, storage keys generated server-side.                                                                                                            |
| Public reports  | Cryptographically random share tokens; no raw ObjectIds or private fields in public payloads.                                                                                                            |
| Secrets         | Server-only env access via `lib/config/env.ts`; secrets redacted in logs.                                                                                                                                |
| Errors          | Internal details logged server-side, generic messages to clients.                                                                                                                                        |

---

## 8. Build phases

| Phase | Tasks | Focus                                                                                                |
| ----- | ----- | ---------------------------------------------------------------------------------------------------- |
| 1     | 01–05 | Foundation: project setup, architecture, MongoDB, authentication, profile.                           |
| 2     | 06–10 | Workspaces, members/roles, projects, dashboard statistics, activity logging.                         |
| 3     | 11–15 | Problems: creation, list/search/filter, detail page, status workflow, uploads.                       |
| 4     | 16–22 | AI: centralized service, classification, diagnosis, planning, task generation, run logging, retries. |
| 5     | 23–26 | Tasks: board, CRUD, drag-and-drop, assignment.                                                       |
| 6     | 27–29 | Evidence: uploads, gallery, metadata.                                                                |
| 7     | 30–32 | Verification: manual engine, AI verification, UI.                                                    |
| 8     | 33–35 | Reports: generation service, PDF, secure public sharing.                                             |
| 9     | 36–40 | Production: search, notifications, hardening, tests, deployment docs.                                |

Each task ends with `npm run typecheck`, `npm run lint` and a production build before
the next task starts, so the application is runnable after every phase.
