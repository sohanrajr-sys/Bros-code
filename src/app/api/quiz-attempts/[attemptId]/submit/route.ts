import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { scoreMcq, scoreShortAnswerDescriptive } from "@/lib/quizScoring";
import { quizGradingQueue } from "@/lib/queue";
import { z } from "zod";

const submitBodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionIds: z.array(z.string()).default([]),
      textAnswer: z.string().optional().nullable(),
      codeLanguage: z.enum(["C", "CPP", "JAVA", "PYTHON", "GO"]).optional().nullable(),
      codeSubmission: z.string().optional().nullable(),
    })
  ),
});

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { mcqOptions: true } } } } },
  });

  if (!attempt || attempt.userId !== user.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "This attempt was already submitted" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const result = submitBodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const isLate = Boolean(
    attempt.quiz.timeLimitMinutes &&
      Date.now() - attempt.startedAt.getTime() > attempt.quiz.timeLimitMinutes * 60_000
  );

  const questionsById = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  const codingAnswerIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { status: "SUBMITTED", submittedAt: new Date(), isLate },
    });

    for (const submitted of result.data.answers) {
      const question = questionsById.get(submitted.questionId);
      if (!question) continue;

      if (question.type === "MCQ") {
        const correctOptionIds = question.mcqOptions.filter((o) => o.isCorrect).map((o) => o.id);
        const autoScore = scoreMcq({
          selectedOptionIds: submitted.selectedOptionIds,
          correctOptionIds,
          scoringMode: question.mcqScoringMode ?? "ALL_OR_NOTHING",
          weight: question.weight,
        });
        await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            selectedOptionIds: submitted.selectedOptionIds,
            autoScore,
            gradingStatus: "GRADED",
          },
        });
      } else if (question.type === "DESCRIPTIVE") {
        const isShortAnswer = question.descriptiveMode === "SHORT_ANSWER";
        const autoScore = isShortAnswer
          ? scoreShortAnswerDescriptive(submitted.textAnswer ?? "", question.acceptedKeywords, question.weight)
          : null;
        await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            textAnswer: submitted.textAnswer ?? "",
            autoScore,
            gradingStatus: isShortAnswer ? "GRADED" : "PENDING",
          },
        });
      } else {
        const answer = await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            codeLanguage: submitted.codeLanguage ?? null,
            codeSubmission: submitted.codeSubmission ?? "",
            gradingStatus: "PENDING",
          },
        });
        codingAnswerIds.push(answer.id);
      }
    }
  });

  for (const quizAnswerId of codingAnswerIds) {
    await quizGradingQueue.add("grade", { quizAnswerId });
  }

  return NextResponse.json({ ok: true });
}
