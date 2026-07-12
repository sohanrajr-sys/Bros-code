A LeetCode-style code judge: DSA and SQL problems, solved in-browser across 5 languages (C, C++, Java, Python, Go), graded by a self-hosted judge. Next.js 16 (App Router) + TypeScript, Postgres via Prisma, Redis + BullMQ for grading, Piston for DSA execution.

## Getting Started (clone and run)

### Prerequisites

- Node 20+ (tested on 24)
- Docker Desktop (or another Docker Engine) — must be **running** before the steps below
- git

### 1. Clone and install

```bash
git clone https://github.com/sohanrajr-sys/Bros-code.git
cd Bros-code
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Defaults in `.env.example` (`DATABASE_URL` / `REDIS_URL` / `PISTON_URL`) point at the
ports the `docker compose` services below expose — no edits needed for local dev.

### 3. Start the backing services

```bash
docker compose up -d
```

This brings up three containers: `postgres` (:5433), `redis` (:6380), and `piston`
(:2000, the code-execution sandbox). Piston needs `privileged: true` — if your Docker
setup denies privileged containers (some locked-down CI sandboxes), the `piston`
container will fail to run submissions even though it starts.

The `piston` image is `linux/amd64`; on Apple Silicon Docker runs it under emulation —
expect a slower pull and slower compiles (especially Java) than a native image.

### 4. Install Piston's language runtimes (one-time)

Piston ships with zero language runtimes installed. Install the five this app needs —
they persist in the `piston_data` volume, so this is a one-time step per machine:

```bash
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"python","version":"3.12.0"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"go","version":"1.16.2"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"java","version":"15.0.2"}'
curl -X POST http://localhost:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"gcc","version":"10.2.0"}'   # covers both c and c++
```

Each install can take a minute or two. Verify all five landed:

```bash
curl -s http://localhost:2000/api/v2/runtimes
# → should list: c, c++, go, java, python
```

### 5. Set up the database

```bash
npx prisma migrate deploy     # applies prisma/migrations/
npm run db:seed               # adds two sample problems (Two Sum, an SQL problem)
```

### 6. Run the app

Two processes, two terminals — the dev server serves pages/API routes, the worker
grades submissions. Submit/Run silently never completes without the worker running.

```bash
npm run dev      # terminal 1 — app on http://localhost:3000
npm run worker   # terminal 2 — consumes the `submissions` queue
```

### 7. Verify it worked

- Problem list: http://localhost:3000
- Solve a problem: http://localhost:3000/problems/two-sum — pick Python, submit the
  starter solution filled in, confirm it grades (pass or fail) instead of hanging.
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
Next.js process — see step 6 above to run it.

- `POST /api/problems/[id]/submissions` — enqueue a submission, returns `{ submissionId }` (202).
- `GET /api/submissions/[id]` — poll for status/results.
- `GET /api/submissions/[id]/stream` — SSE stream of status changes until a terminal state.

SQL submissions are graded directly against the shared Postgres instance
(schema-per-submission, dropped after grading) and need no extra services.

DSA submissions (C/C++/Java/Python/Go) are graded via the self-hosted
[Piston](https://github.com/engineer-man/piston) instance set up in steps 3–4 above.
