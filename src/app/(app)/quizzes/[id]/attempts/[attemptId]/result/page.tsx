import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { effectiveScore } from "@/lib/quizScoring";

export const dynamic = "force-dynamic";

export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await getSessionUserFromCookies();
  if (!user) notFound();

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { select: { title: true } },
      answers: {
        include: {
          // Explicit select, not a bare include: QuizQuestion also carries
          // acceptedKeywords (the short-answer descriptive answer key), which
          // is never appropriate to show a student even after finalization —
          // it would let them answer future attempts or tell classmates.
          // mcqOptions.isCorrect, by contrast, IS intentionally shown here:
          // once an attempt is finalized the design spec has the student see
          // which options were actually correct (unlike the taking-page and
          // attempt-detail routes, which withhold it).
          question: {
            select: {
              id: true,
              type: true,
              weight: true,
              prompt: true,
              mcqOptions: {
                orderBy: { order: "asc" },
                select: { id: true, text: true, isCorrect: true, order: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.userId) notFound();

  if (attempt.status !== "FINALIZED") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-text-muted">Submitted — waiting for results.</p>
      </main>
    );
  }

  const total = attempt.answers.reduce(
    (sum, a) => sum + effectiveScore(a.autoScore, a.overriddenScore),
    0
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">{attempt.quiz.title} &middot; Result</h1>
      <p className="mt-1 text-2xl font-semibold text-mint">{total}/100</p>

      <div className="mt-6 flex flex-col gap-4">
        {attempt.answers.map((a) => {
          const score = effectiveScore(a.autoScore, a.overriddenScore);
          const correctOptions = a.question.mcqOptions.filter((o) => o.isCorrect).map((o) => o.text);
          return (
            <div key={a.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-text-muted">{a.question.type}</span>
                <span className="text-sm font-medium text-foreground">
                  {score}/{a.question.weight}
                </span>
              </div>
              {a.question.prompt && <p className="mt-2 text-sm text-foreground">{a.question.prompt}</p>}
              {correctOptions.length > 0 && (
                <p className="mt-2 text-xs text-text-muted">Correct answer: {correctOptions.join(", ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
