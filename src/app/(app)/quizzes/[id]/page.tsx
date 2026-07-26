import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { QuizWorkspace } from "@/components/quiz/QuizWorkspace";

export const dynamic = "force-dynamic";

export default async function TakeQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.status !== "PUBLISHED") notFound();

  let attempt = await prisma.quizAttempt.findFirst({
    where: { quizId: id, userId: user.userId, status: "IN_PROGRESS" },
  });

  if (!attempt) {
    const attemptCount = await prisma.quizAttempt.count({ where: { quizId: id, userId: user.userId } });
    if (attemptCount >= quiz.maxAttempts) {
      return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          <p className="text-text-muted">You&apos;ve used all your attempts for this quiz.</p>
        </main>
      );
    }
    attempt = await prisma.quizAttempt.create({
      data: { quizId: id, userId: user.userId, attemptNumber: attemptCount + 1 },
    });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-text-muted">Submitted — waiting for results.</p>
      </main>
    );
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: id },
    orderBy: { order: "asc" },
    // Explicit select, not a bare include: QuizQuestion also carries
    // acceptedKeywords (the short-answer descriptive answer key) — withheld
    // the same way it's withheld from GET /api/quiz-attempts/[attemptId].
    select: {
      id: true,
      type: true,
      prompt: true,
      mcqOptions: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } }, // isCorrect withheld
      codingQuestion: { select: { description: true, constraints: true } },
    },
  });

  return (
    <QuizWorkspace
      attemptId={attempt.id}
      quizTitle={quiz.title}
      timeLimitMinutes={quiz.timeLimitMinutes}
      startedAt={attempt.startedAt.toISOString()}
      questions={questions}
    />
  );
}
