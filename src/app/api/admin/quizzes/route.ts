import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { quizInputSchema } from "@/lib/quizSchema";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  // Quizzes are always created as drafts — publishing happens via PUT, which
  // re-validates weights. Force it here regardless of what the client sent.
  const result = quizInputSchema.safeParse({ ...body, status: "DRAFT" });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body", issues: result.error.issues },
      { status: 400 }
    );
  }

  const { questions, ...quizFields } = result.data;

  const quiz = await prisma.quiz.create({
    data: {
      ...quizFields,
      createdBy: user.userId,
      questions: { create: questions.map((q) => buildQuestionCreateInput(q)) },
    },
    include: { questions: { include: { mcqOptions: true, codingQuestion: { include: { testCases: true } } } } },
  });

  return NextResponse.json({ quiz }, { status: 201 });
}

// Shared with the [id] route's PUT handler.
export function buildQuestionCreateInput(q: import("@/lib/quizSchema").QuizQuestionInput) {
  if (q.type === "MCQ") {
    return {
      order: q.order,
      weight: q.weight,
      type: "MCQ" as const,
      prompt: q.prompt,
      mcqScoringMode: q.mcqScoringMode,
      mcqOptions: { create: q.mcqOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })) },
    };
  }
  if (q.type === "DESCRIPTIVE") {
    return {
      order: q.order,
      weight: q.weight,
      type: "DESCRIPTIVE" as const,
      prompt: q.prompt,
      descriptiveMode: q.descriptiveMode,
      acceptedKeywords: q.acceptedKeywords,
    };
  }
  return {
    order: q.order,
    weight: q.weight,
    type: "CODING" as const,
    codingQuestion: {
      create: {
        description: q.description,
        constraints: q.constraints ?? null,
        functionSignature: q.functionSignature as unknown as Prisma.InputJsonValue,
        testCases: { create: q.testCases.map((tc) => ({ ...tc })) },
      },
    },
  };
}
