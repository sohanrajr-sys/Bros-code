import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QuizListPage() {
  const user = await getSessionUserFromCookies();
  if (!user) return null; // AppLayout already redirects unauthenticated visitors

  const now = new Date();
  const quizzes = await prisma.quiz.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    include: { attempts: { where: { userId: user.userId } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Quizzes</h1>
      <p className="mt-1 text-sm text-text-muted">
        {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"} available
      </p>

      {quizzes.length === 0 ? (
        <p className="mt-8 text-text-muted">No quizzes available right now.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {quizzes.map((quiz) => {
            const attemptsUsed = quiz.attempts.length;
            const exhausted = attemptsUsed >= quiz.maxAttempts && !quiz.attempts.some((a) => a.status === "IN_PROGRESS");
            return (
              <li key={quiz.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{quiz.title}</span>
                  <span className="text-xs text-text-muted">
                    {attemptsUsed}/{quiz.maxAttempts} attempts used
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-muted">{quiz.description}</p>
                <div className="mt-3">
                  {exhausted ? (
                    <span className="text-xs text-text-muted">No attempts remaining</span>
                  ) : (
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="inline-flex min-h-[44px] items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
                    >
                      {quiz.attempts.some((a) => a.status === "IN_PROGRESS") ? "Resume" : "Start"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
