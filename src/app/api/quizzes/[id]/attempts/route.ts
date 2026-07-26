import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const now = new Date();
  if (quiz.opensAt && now < quiz.opensAt) {
    return NextResponse.json({ error: "This quiz hasn't opened yet" }, { status: 403 });
  }
  if (quiz.closesAt && now > quiz.closesAt) {
    return NextResponse.json({ error: "This quiz has closed" }, { status: 403 });
  }

  const existingAttempts = await prisma.quizAttempt.findMany({
    where: { quizId: id, userId: user.userId },
    orderBy: { attemptNumber: "desc" },
  });

  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return NextResponse.json({ attempt: inProgress });
  }

  if (existingAttempts.length >= quiz.maxAttempts) {
    return NextResponse.json({ error: "You've used all your attempts for this quiz" }, { status: 403 });
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: id,
      userId: user.userId,
      attemptNumber: existingAttempts.length + 1,
    },
  });

  return NextResponse.json({ attempt }, { status: 201 });
}
