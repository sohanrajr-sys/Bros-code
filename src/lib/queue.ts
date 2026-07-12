import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const SUBMISSIONS_QUEUE = "submissions";

export interface SubmissionJobData {
  submissionId: string;
}

const globalForQueue = globalThis as unknown as {
  submissionsQueue: Queue<SubmissionJobData> | undefined;
};

export const submissionsQueue =
  globalForQueue.submissionsQueue ??
  new Queue<SubmissionJobData>(SUBMISSIONS_QUEUE, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.submissionsQueue = submissionsQueue;
}
