import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizForm, type QuizFormInitial } from "@/components/admin/QuizForm";
import type { QuestionDraft } from "@/components/admin/QuizQuestionEditor";
import type { FunctionSignature } from "@/lib/functionSignature";

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { mcqOptions: { orderBy: { order: "asc" } }, codingQuestion: { include: { testCases: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!quiz) notFound();

  const initial: QuizFormInitial = {
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    opensAt: quiz.opensAt ? quiz.opensAt.toISOString().slice(0, 16) : "",
    closesAt: quiz.closesAt ? quiz.closesAt.toISOString().slice(0, 16) : "",
    timeLimitMinutes: quiz.timeLimitMinutes ? String(quiz.timeLimitMinutes) : "",
    maxAttempts: quiz.maxAttempts,
    questions: quiz.questions.map((q): QuestionDraft => {
      if (q.type === "MCQ") {
        return {
          type: "MCQ",
          order: q.order,
          weight: q.weight,
          prompt: q.prompt ?? "",
          mcqScoringMode: q.mcqScoringMode ?? "ALL_OR_NOTHING",
          mcqOptions: q.mcqOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
        };
      }
      if (q.type === "DESCRIPTIVE") {
        return {
          type: "DESCRIPTIVE",
          order: q.order,
          weight: q.weight,
          prompt: q.prompt ?? "",
          descriptiveMode: q.descriptiveMode ?? "SHORT_ANSWER",
          acceptedKeywords: q.acceptedKeywords,
        };
      }
      return {
        type: "CODING",
        order: q.order,
        weight: q.weight,
        description: q.codingQuestion?.description ?? "",
        constraints: q.codingQuestion?.constraints ?? null,
        functionSignature: (q.codingQuestion?.functionSignature as unknown as FunctionSignature) ?? {
          functionName: "",
          params: [{ name: "", type: "int" }],
          returnType: "int",
        },
        testCases: (q.codingQuestion?.testCases ?? []).map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          order: tc.order,
        })),
      };
    }),
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Edit quiz</h1>
      <div className="mt-6">
        <QuizForm mode="edit" quizId={quiz.id} initial={initial} />
      </div>
    </main>
  );
}
