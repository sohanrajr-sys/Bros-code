import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

type RouteParams = { params: Promise<{ attemptId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
            include: { mcqOptions: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  return NextResponse.json({ attempt });
}

const overrideBodySchema = z.object({
  questionId: z.string(),
  overriddenScore: z.number(),
});

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const result = overrideBodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const answer = await prisma.quizAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId: result.data.questionId } },
  });
  if (!answer) {
    return NextResponse.json({ error: "Answer not found" }, { status: 404 });
  }

  const updated = await prisma.quizAnswer.update({
    where: { id: answer.id },
    data: { overriddenScore: result.data.overriddenScore, gradingStatus: "GRADED" },
  });

  return NextResponse.json({ answer: updated });
}
