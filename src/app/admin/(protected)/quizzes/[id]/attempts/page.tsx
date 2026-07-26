import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";

export const dynamic = "force-dynamic";

export default async function QuizAttemptsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { title: true } });
  if (!quiz) notFound();

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: id },
    orderBy: { startedAt: "desc" },
    include: { user: { select: { name: true, studentId: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">{quiz.title} &middot; Attempts</h1>
      <p className="mt-1 text-sm text-text-muted">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</p>

      {attempts.length === 0 ? (
        <p className="mt-8 text-text-muted">No one has attempted this quiz yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {attempts.map((attempt) => (
            <li key={attempt.id} className="flex items-center justify-between rounded-lg border border-navy-border bg-navy-900 px-4 py-3">
              <div>
                <span className="font-medium text-foreground">{attempt.user.name}</span>
                <span className="ml-2 text-xs text-text-muted">{attempt.user.studentId}</span>
                {attempt.isLate && <span className="ml-2 rounded bg-amber/15 px-2 py-0.5 text-xs text-amber">Late</span>}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    attempt.status === "FINALIZED" ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"
                  }`}
                >
                  {attempt.status === "FINALIZED" ? "Finalized" : attempt.status === "SUBMITTED" ? "Submitted" : "In progress"}
                </span>
                <Link
                  href={`/admin/quizzes/${id}/attempts/${attempt.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                >
                  Review
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
