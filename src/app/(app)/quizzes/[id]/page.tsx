import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { QuizWorkspace } from "@/components/quiz/QuizWorkspace";
import { startOrResumeAttempt } from "@/lib/quizAttempts";

export const dynamic = "force-dynamic";

function InfoMessage({ text }: { text: string }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-text-muted">{text}</p>
    </main>
  );
}

export default async function TakeQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");
  // Not a confidentiality concern the way the API withholding is — just
  // keeps this page's only real audience (students) from accidentally
  // creating QuizAttempt rows under a non-student account.
  if (user.role !== "student") notFound();

  const { id } = await params;
  // Same start-or-resume logic POST /api/quizzes/[id]/attempts uses — one
  // shared function so a fix to attempt-window/race handling can't miss
  // one of the two call sites.
  const result = await startOrResumeAttempt(id, user.userId);

  if (result.status === "not_found") notFound();
  if (result.status === "not_open") return <InfoMessage text="This quiz hasn't opened yet." />;
  if (result.status === "closed") return <InfoMessage text="This quiz has closed." />;
  if (result.status === "exhausted") return <InfoMessage text="You've used all your attempts for this quiz." />;
  if (result.status === "awaiting_results") return <InfoMessage text="Submitted — waiting for results." />;

  const { attempt } = result;
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id } });

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
