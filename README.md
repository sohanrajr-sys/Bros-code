This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
