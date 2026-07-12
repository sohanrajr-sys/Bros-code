import "dotenv/config";
import { Worker, type Job } from "bullmq";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redisConnection } from "@/lib/redis";
import { SUBMISSIONS_QUEUE, type SubmissionJobData } from "@/lib/queue";
import { gradeSql } from "./graders/sql";
import { gradeDsa } from "./graders/dsa";

async function processSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        include: { testCases: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!submission) {
    console.error(`submission ${submissionId} not found, skipping`);
    return;
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "RUNNING" },
  });

  try {
    const { problem } = submission;
    const outcome =
      problem.type === "SQL"
        ? await gradeSql(submission.id, submission.code, problem.testCases)
        : await gradeDsa(submission.language, submission.code, problem.testCases);

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: outcome.passed ? "PASSED" : "FAILED",
        results: outcome.results as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`submission ${submissionId} errored`, err);
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "ERROR",
        results: { error: message },
      },
    });
  }
}

const worker = new Worker<SubmissionJobData>(
  SUBMISSIONS_QUEUE,
  async (job: Job<SubmissionJobData>) => {
    await processSubmission(job.data.submissionId);
  },
  { connection: redisConnection, concurrency: 4 }
);

worker.on("completed", (job) => {
  console.log(`submission ${job.data.submissionId} graded`);
});

worker.on("failed", (job, err) => {
  console.error(`job ${job?.id} (submission ${job?.data.submissionId}) failed unexpectedly`, err);
});

console.log(`judge worker listening on queue "${SUBMISSIONS_QUEUE}"...`);

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
