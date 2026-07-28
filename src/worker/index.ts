import "dotenv/config";
import { Worker, type Job } from "bullmq";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redisConnection } from "@/lib/redis";
import { SUBMISSIONS_QUEUE, type SubmissionJobData, QUIZ_GRADING_QUEUE, type QuizGradingJobData } from "@/lib/queue";
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
        : await gradeDsa(submission.language, submission.code, problem.testCases, problem.functionSignature);

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

async function processQuizAnswer(quizAnswerId: string): Promise<void> {
  const answer = await prisma.quizAnswer.findUnique({
    where: { id: quizAnswerId },
    include: {
      question: {
        include: {
          codingQuestion: {
            include: { testCases: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!answer) {
    console.error(`quiz answer ${quizAnswerId} not found, skipping`);
    return;
  }

  const codingQuestion = answer.question.codingQuestion;
  if (!codingQuestion || !answer.codeLanguage || answer.codeSubmission === null) {
    console.error(`quiz answer ${quizAnswerId} is missing coding question data, skipping`);
    return;
  }

  try {
    const outcome = await gradeDsa(
      answer.codeLanguage,
      answer.codeSubmission,
      codingQuestion.testCases,
      codingQuestion.functionSignature
    );

    const passedFraction =
      outcome.results.cases.length === 0
        ? 0
        : outcome.results.cases.filter((c) => c.passed).length / outcome.results.cases.length;
    const autoScore = Math.round(passedFraction * answer.question.weight * 100) / 100;

    await prisma.quizAnswer.update({
      where: { id: quizAnswerId },
      data: { autoScore, gradingStatus: "GRADED" },
    });
  } catch (err) {
    console.error(`quiz answer ${quizAnswerId} errored during grading`, err);
    throw err;
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

const quizWorker = new Worker<QuizGradingJobData>(
  QUIZ_GRADING_QUEUE,
  async (job: Job<QuizGradingJobData>) => {
    await processQuizAnswer(job.data.quizAnswerId);
  },
  { connection: redisConnection, concurrency: 4 }
);

quizWorker.on("completed", (job) => {
  console.log(`quiz answer ${job.data.quizAnswerId} graded`);
});

quizWorker.on("failed", (job, err) => {
  console.error(`job ${job?.id} (quiz answer ${job?.data.quizAnswerId}) failed unexpectedly`, err);
});

console.log(`judge worker listening on queues "${SUBMISSIONS_QUEUE}" and "${QUIZ_GRADING_QUEUE}"...`);

async function shutdown() {
  await worker.close();
  await quizWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
