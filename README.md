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

Auth needs two more things set in `.env` before seeding: `SESSION_SECRET` (any long
random string — e.g. `openssl rand -base64 32`) and `ADMIN_EMAIL`/`ADMIN_PASSWORD`
(credentials for the first admin account, created by `db:seed` below). See "Auth" further
down for how login works.

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
npm run db:seed               # bootstraps the admin account + sample problems
```

### 6. Run the app

Two processes, two terminals — the dev server serves pages/API routes, the worker
grades submissions. Submit/Run silently never completes without the worker running.

```bash
npm run dev      # terminal 1 — app on http://localhost:3000
npm run worker   # terminal 2 — consumes the `submissions` queue
```

### 7. Verify it worked

- Student login: http://localhost:3000/login — log in as a student added via
  `/admin/students` (see "Auth" below).
- Admin login: http://localhost:3000/admin/login — use the `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  from your `.env`.
- Solve a problem: http://localhost:3000/problems/two-sum (while logged in) — pick Python,
  submit the starter solution filled in, confirm it grades (pass or fail) instead of hanging.

## Auth

Two separate, credential-based logins — no self-registration for either role:

- **Students** sign in at `/login` with a Student ID + password. Admins create student
  accounts (and their auto-generated, one-time-shown passwords) at `/admin/students`.
- **Admins** sign in at `/admin/login` with an email + password. The first admin account
  is bootstrapped by `npm run db:seed` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`
  (re-running `db:seed` never overwrites an existing admin's password).

Sessions are a signed JWT (`jose`, `SESSION_SECRET` in `.env`) in an httpOnly cookie,
verified both optimistically in `src/proxy.ts` (redirects logged-out visitors to the right
login page) and per-request in every Server Component/Route Handler/Server Action via
`getSessionUser`/`getSessionUserFromCookies` (`src/lib/session.ts`) — Proxy alone is never
trusted as the sole gate. Passwords are hashed with `bcrypt` (`src/lib/password.ts`).

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
