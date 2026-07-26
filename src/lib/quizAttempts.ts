import { prisma } from "@/lib/prisma";
import type { QuizAttempt } from "@/generated/prisma/client";

export type StartAttemptResult =
  | { status: "started"; attempt: QuizAttempt; isNew: boolean }
  | { status: "not_found" }
  | { status: "not_open" }
  | { status: "closed" }
  | { status: "exhausted" }
  | { status: "awaiting_results"; attempt: QuizAttempt };

/**
 * Shared by POST /api/quizzes/[id]/attempts and the /quizzes/[id] taking
 * page — both need identical start-or-resume semantics (window checks,
 * max-attempts enforcement, and safe handling of a concurrent double-start
 * racing the @@unique([quizId, userId, attemptNumber]) constraint). Keeping
 * this in one place means a fix to one call site can't silently miss the
 * other, the way the page's now-removed inline duplicate of this logic did.
 */
export async function startOrResumeAttempt(quizId: string, userId: string): Promise<StartAttemptResult> {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.status !== "PUBLISHED") {
    return { status: "not_found" };
  }

  const now = new Date();
  if (quiz.opensAt && now < quiz.opensAt) {
    return { status: "not_open" };
  }
  if (quiz.closesAt && now > quiz.closesAt) {
    return { status: "closed" };
  }

  const existingAttempts = await prisma.quizAttempt.findMany({
    where: { quizId, userId },
  });

  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return { status: "started", attempt: inProgress, isNew: false };
  }

  if (existingAttempts.length >= quiz.maxAttempts) {
    // Distinguish "you submitted, it just isn't graded/finalized yet" from a
    // plain "you're out of attempts" — the two mean different things to a
    // student checking back on a quiz.
    const mostRecent = existingAttempts.reduce((latest, a) => (a.attemptNumber > latest.attemptNumber ? a : latest));
    if (mostRecent.status === "SUBMITTED") {
      return { status: "awaiting_results", attempt: mostRecent };
    }
    return { status: "exhausted" };
  }

  try {
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        attemptNumber: existingAttempts.length + 1,
      },
    });
    return { status: "started", attempt, isNew: true };
  } catch (err: unknown) {
    // A concurrent request (double-click, retry on a slow connection) could
    // have raced this one to the same attemptNumber — the unique constraint
    // catches it; resolve it the same way an already-in-progress attempt
    // resolves, rather than surfacing a raw 500.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      const winner = await prisma.quizAttempt.findFirst({
        where: { quizId, userId, status: "IN_PROGRESS" },
      });
      if (winner) {
        return { status: "started", attempt: winner, isNew: false };
      }
    }
    throw err;
  }
}
