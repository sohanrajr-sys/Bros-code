import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";

export const dynamic = "force-dynamic";

async function getQuizzes() {
  return prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });
}

export default async function AdminQuizzesPage() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const quizzes = await getQuizzes();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin: Quizzes</h1>
          <p className="mt-1 text-sm text-text-muted">
            {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}
          </p>
        </div>
        <Link
          href="/admin/quizzes/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
        >
          New quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <p className="mt-8 text-text-muted">No quizzes yet. Create one to get started.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{quiz.title}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        quiz.status === "PUBLISHED" ? "bg-mint/15 text-mint" : "bg-navy-800 text-text-muted"
                      }`}
                    >
                      {quiz.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {quiz._count.questions} question{quiz._count.questions === 1 ? "" : "s"} &middot;{" "}
                    {quiz._count.attempts} attempt{quiz._count.attempts === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/quizzes/${quiz.id}/attempts`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                  >
                    Attempts
                  </Link>
                  <Link
                    href={`/admin/quizzes/${quiz.id}/edit`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
