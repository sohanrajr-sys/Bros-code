import { notFound, redirect } from "next/navigation";
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
  if (!user) redirect("/login");

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { select: { title: true } },
      answers: {
        orderBy: { question: { order: "asc" } },
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
              // description/constraints only, same as everywhere else in this
              // feature — functionSignature/testCases aren't needed for a
              // read-only result view.
              codingQuestion: { select: { description: true, constraints: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.userId) notFound();

  if (attempt.status === "IN_PROGRESS") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-text-muted">This attempt hasn&apos;t been submitted yet.</p>
      </main>
    );
  }

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
          const prompt = a.question.type === "CODING" ? a.question.codingQuestion?.description : a.question.prompt;

          return (
            <div key={a.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-text-muted">{a.question.type}</span>
                <span className="text-sm font-medium text-foreground">
                  {score}/{a.question.weight}
                </span>
              </div>
              {prompt && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{prompt}</p>}
              {a.question.type === "CODING" && a.question.codingQuestion?.constraints && (
                <p className="mt-1 text-xs text-text-muted">{a.question.codingQuestion.constraints}</p>
              )}

              {a.question.type === "MCQ" && (
                <ul className="mt-3 flex flex-col gap-1">
                  {a.question.mcqOptions.map((opt) => {
                    const selected = a.selectedOptionIds.includes(opt.id);
                    return (
                      <li
                        key={opt.id}
                        className={`rounded border px-3 py-1.5 text-sm ${
                          opt.isCorrect
                            ? "border-mint/40 bg-mint/10 text-mint"
                            : selected
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-navy-border text-text-muted"
                        }`}
                      >
                        {selected ? "☑" : "☐"} {opt.text}
                        {opt.isCorrect && <span className="ml-2 text-xs">(correct)</span>}
                      </li>
                    );
                  })}
                </ul>
              )}

              {a.question.type === "DESCRIPTIVE" && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-text-muted">Your answer</div>
                  <p className="whitespace-pre-wrap rounded border border-navy-border bg-navy-950 p-3 text-sm text-text">
                    {a.textAnswer || <span className="text-text-muted">(no answer submitted)</span>}
                  </p>
                </div>
              )}

              {a.question.type === "CODING" && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-text-muted">Your submission ({a.codeLanguage})</div>
                  <pre className="overflow-x-auto rounded border border-navy-border bg-navy-950 p-3 text-xs text-text">
                    {a.codeSubmission || "(no code submitted)"}
                  </pre>
                </div>
              )}

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
