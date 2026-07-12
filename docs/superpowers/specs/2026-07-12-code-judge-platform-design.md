# LeetCode-style Code Judge Platform — Design

## Summary

A standalone Next.js + TypeScript application that lets an admin author DSA and SQL practice problems (with test cases) and lets students solve them in a browser-based, multi-language code editor (C, C++, Java, Python, Go, Scala). The system is built as a "plug and play" component: a clean REST API sits behind every UI action, so problems can be added or solved either through the app's own UI or programmatically. Pages are built to be embeddable via iframe so the tool can later be dropped into a Learning Management System (LMS) without rearchitecting.

Visual design follows LeetCode's two-panel layout (problem description + editor) but with a distinct color grading: deep navy base with cyan and mint accents, chosen and approved via visual mockup during design.

Authentication is **out of scope** for this project — a teammate is building a separate auth system for both admin and student accounts. This system only needs to consume a `role` (`admin` | `student`) and `userId` from whatever session/auth mechanism is wired in, and gate routes/UI accordingly.

## Goals

- Admin can create, edit, and manage DSA and SQL problems, each with one or more test cases (including hidden test cases).
- Students can browse problems, write code in 6 languages, run against sample tests, and submit for full grading.
- All problem/submission functionality is available both through the web UI and through a REST API, so the "problem editor" and "code editor" can be reused/embedded elsewhere (e.g., an LMS) later.
- Visual theme distinct from stock LeetCode (navy/cyan/mint) while keeping a familiar, recognizable layout.
- Runs 6 languages safely via a sandboxed execution engine, without building custom sandboxing infrastructure from scratch.

## Non-Goals

- Building the authentication/authorization system itself (handled by a teammate). We only consume role/session data.
- Building an LTI launch integration now — the design keeps this possible later (iframe-safe pages, token-friendly auth hook) but does not implement it.
- Partial-credit / rubric-based grading — grading is all-or-nothing per submission (see Grading below).
- Building a custom code-execution sandbox — Judge0 is used instead.

## Architecture

Three cooperating pieces, all deployable via a single `docker-compose.yml`:

1. **Web app (Next.js, App Router, TypeScript)**
   - Problem list / browse page
   - Solve page: LeetCode-style split panel — problem description (left) + Monaco-based code editor (right), language selector, Run (sample tests) and Submit (full grading) actions
   - Admin authoring UI (role-gated): create/edit problems, manage test cases
   - Pages avoid hard dependencies on a top-level nav/layout so they can be safely rendered inside an iframe later; auth/session is read via a pluggable hook (see Auth Integration).

2. **API layer (Next.js Route Handlers)**
   - `/api/problems` — list/read problems (public/student-facing, respects `isHidden` on test cases)
   - `/api/problems/[id]/submissions` — submit code, poll/stream submission status
   - `/api/admin/problems` — create/update/delete problems and test cases (role-gated: `admin` only)
   - This is the actual "plug-n-play" surface. The UI is just one consumer of these routes; scripts, CI, or an LMS integration can call the same endpoints directly.

3. **Judge worker (BullMQ + Redis)**
   - Consumes submission jobs enqueued by the API layer.
   - For DSA problems (C, C++, Java, Python, Go, Scala): dispatches each test case to **Judge0** (self-hosted via Docker), which handles per-language sandboxing, compilation, execution, and resource/time limits natively.
   - For SQL problems: creates a temporary schema in the shared Postgres instance, runs the problem's seed SQL, runs the student's submitted query against it, diffs the resulting row set against the expected result set, then drops the temp schema.
   - Judge0 posts results back via webhook; the worker aggregates per-test-case results, updates the `Submission` row, and pushes the final result to the client over SSE.

## Data Model (Prisma / Postgres)

```
Problem
  id            String   @id
  slug          String   @unique
  title         String
  description   String   // markdown
  difficulty    Easy | Medium | Hard
  tags          String[]
  type          "dsa" | "sql"
  constraints   String?  // free text, shown in UI
  createdBy     String   // userId from external auth
  createdAt     DateTime
  updatedAt     DateTime

TestCase
  id            String   @id
  problemId     String
  input         String   // DSA: stdin text. SQL: seed SQL.
  expectedOutput String  // DSA: expected stdout text. SQL: serialized expected result set.
  isHidden      Boolean  // hidden tests run but are not shown in detail to students
  order         Int

Submission
  id            String   @id
  userId        String   // from external auth, no local user table needed
  problemId     String
  language       "c" | "cpp" | "java" | "python" | "go" | "scala" | "sql"
  code          String
  status        "queued" | "running" | "passed" | "failed" | "error"
  results       Json     // per-test-case pass/fail + first-failure actual/expected
  createdAt     DateTime
```

No local `User` table — `userId` and `role` are treated as opaque values supplied by the external auth system.

## Execution Flow

1. Student clicks **Run** (sample tests only) or **Submit** (all tests, including hidden).
2. API creates a `Submission` row (`status = queued`) and enqueues a BullMQ job.
3. Worker picks up the job:
   - **DSA:** submits code + each test case's input to Judge0, gets back a token per test case, waits for Judge0's webhook callback per token.
   - **SQL:** creates temp Postgres schema, runs seed SQL, runs submitted query, captures result set.
4. Worker compares actual vs. expected output per test case.
5. Grading is **all-or-nothing**: the submission is marked `passed` only if every test case (visible and hidden) passes. If any fail, `status = failed` and `results` includes full detail for the **first failing** test case (input, expected, actual) plus pass/fail flags (no detail) for the rest — matching LeetCode's behavior of not leaking all hidden test data on failure.
6. Worker updates the `Submission` row; result is pushed to the client via SSE for live status updates (no client polling loop needed).

## Problem Authoring

Test cases are authored as **input/output text pairs** — for DSA problems this is raw stdin text and expected stdout text (matching Judge0's execution model directly, works uniformly across all 6 languages with zero per-language codegen). For SQL problems, "input" is the seed SQL script and "expected output" is the expected result set.

Admin authoring happens through the `/admin` UI, which is a thin layer over `POST/PUT/DELETE /api/admin/problems` — meaning problems can equally well be added by a script or CI pipeline hitting the same API with an authenticated admin session, satisfying the "add problems via class or API" requirement.

## Auth Integration

This system does not implement login. It expects:
- A `role` claim (`admin` | `student`) and `userId`, available server-side (e.g., via a session object or JWT) through a single pluggable function/hook (e.g., `getSessionUser(req)`), which the teammate's auth system will implement to match whatever mechanism they build.
- Route handlers under `/api/admin/*` and the `/admin` UI check `role === "admin"`; everything else just requires a valid `userId`.
- This isolation means swapping in the real auth implementation later only touches one integration point, not the problem/judge logic.

## Theming

Layout mirrors LeetCode's structure (problem panel + editor panel) but uses a distinct palette, chosen via visual mockup comparison and approved:

- Base: deep navy (`#0d1420` / `#0a0f1a`)
- Accent: cyan (`#4dd0e1`)
- Success / Easy tag: mint (`#16f19a`)
- Keyword highlight: warm amber (`#f0c674`)

Implemented as Tailwind theme tokens (not hardcoded colors) so the palette can be swapped later without touching component logic.

## Deployment

Single `docker-compose.yml` running: Next.js app, Postgres, Redis, and self-hosted Judge0 (which itself runs Docker-in-Docker for its per-language execution workers). Suitable for a single VM; no additional infra required to get all 6 languages working.

## Open Questions / Future Work

- LTI launch endpoint for formal LMS integration (deferred — current design keeps pages iframe-safe so this can be added without rearchitecting).
- Partial-credit grading, if a future LMS use case requires rubric-based scoring instead of pass/fail.
- Rate limiting / abuse prevention on the submission endpoint (not addressed in this pass).
