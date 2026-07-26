import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizAttemptReview } from "@/components/admin/QuizAttemptReview";

export const dynamic = "force-dynamic";

export default async function QuizAttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, studentId: true } },
      quiz: { select: { title: true } },
      answers: {
        include: {
          question: {
            select: {
              type: true,
              prompt: true,
              weight: true,
              mcqOptions: { orderBy: { order: "asc" }, select: { id: true, text: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">
        {attempt.quiz.title} &middot; {attempt.user.name}
      </h1>
      <p className="mt-1 text-sm text-text-muted">{attempt.user.studentId}</p>

      <div className="mt-6">
        <QuizAttemptReview attemptId={attempt.id} status={attempt.status} answers={attempt.answers} />
      </div>
    </main>
  );
}
