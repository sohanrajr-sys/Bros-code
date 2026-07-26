import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  });

  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return NextResponse.json({ attempt: inProgress });
  }

  if (existingAttempts.length >= quiz.maxAttempts) {
    return NextResponse.json({ error: "You've used all your attempts for this quiz" }, { status: 403 });
  }

  try {
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: id,
        userId: user.userId,
        attemptNumber: existingAttempts.length + 1,
      },
    });

    return NextResponse.json({ attempt }, { status: 201 });
  } catch (err: unknown) {
    // A concurrent request (double-click, retry on a slow connection) could
    // have raced this one to the same attemptNumber — the unique constraint
    // catches it; resolve it the same way an already-in-progress attempt
    // resolves, rather than surfacing a raw 500.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      const winner = await prisma.quizAttempt.findFirst({
        where: { quizId: id, userId: user.userId, status: "IN_PROGRESS" },
      });
      if (winner) {
        return NextResponse.json({ attempt: winner });
      }
    }
    throw err;
  }
}
