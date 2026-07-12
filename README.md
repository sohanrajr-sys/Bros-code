A LeetCode-style code judge: DSA and SQL problems, solved in-browser across 6 languages (C, C++, Java, Python, Go, Scala), graded by a self-hosted judge. Next.js 14 (App Router) + TypeScript, Postgres via Prisma, Redis + BullMQ for grading, Judge0 for DSA execution.

## Getting Started (clone and run)

Requires Node 20+ and Docker.

```bash
npm install
cp .env.example .env          # DATABASE_URL / REDIS_URL / JUDGE0_URL — defaults work as-is
docker compose up -d postgres redis
npx prisma migrate deploy     # applies prisma/migrations/
npm run db:seed               # adds two sample problems (Two Sum, an SQL problem)
npm run dev                   # app on http://localhost:3000
```

In a second terminal, start the judge worker (required for Submit/Run to grade anything):

```bash
npm run worker
```

- Problem list: http://localhost:3000
- Solve a problem: http://localhost:3000/problems/two-sum
- Admin (create/edit problems): http://localhost:3000/admin/problems — set a `debug-role=admin` cookie first (see "Auth" below).

## Auth

Real authentication is being built separately and isn't part of this repo yet.
`src/lib/session.ts` is a temporary stand-in: it reads `x-debug-role`/
`x-debug-user-id` headers (API requests) or `debug-role`/`debug-user-id`
cookies (browser), defaulting to `{ role: "student" }` if absent. The admin
UI has a dev-only role switcher (`src/app/admin/layout.tsx`) that sets the
cookie for you. Swap `getSessionUser`/`getSessionUserFromCookies` for the
real implementation once it lands — nothing else should need to change.

## Judge execution

Submissions are graded asynchronously by a BullMQ worker, separate from the
Next.js process:

```bash
docker compose up -d postgres redis   # shared Postgres + Redis
npm run worker                        # consumes the `submissions` queue
```

- `POST /api/problems/[id]/submissions` — enqueue a submission, returns `{ submissionId }` (202).
- `GET /api/submissions/[id]` — poll for status/results.
- `GET /api/submissions/[id]/stream` — SSE stream of status changes until a terminal state.

SQL submissions are graded directly against the shared Postgres instance
(schema-per-submission, dropped after grading) and need no extra services.

DSA submissions (C/C++/Java/Python/Go/Scala) are graded via a self-hosted
[Judge0](https://github.com/judge0/judge0) instance:

```bash
docker compose up -d judge0-server judge0-workers judge0-db judge0-redis
```

Judge0's `isolate` sandbox needs `privileged: true` and cgroup access that
some container runtimes (e.g. locked-down CI sandboxes, some local Docker
Desktop configurations) don't grant. In this repo's dev sandbox, `judge0-server`
starts and serves `/languages` fine, but every submission fails with
`Failed to create control group /sys/fs/cgroup/memory/box-1/: No such file
or directory` — that's a host/runtime limitation, not an application bug.
Verify actual code execution on a real VM or a Docker host that allows
privileged containers and exposes cgroups.
