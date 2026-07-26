import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            // Explicit select, not a bare include: QuizQuestion also carries
            // acceptedKeywords (the short-answer descriptive answer key) —
            // withheld the same way isCorrect/hidden test cases are below.
            select: {
              id: true,
              order: true,
              type: true,
              weight: true,
              prompt: true,
              mcqScoringMode: true,
              descriptiveMode: true,
              mcqOptions: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } }, // isCorrect withheld
              codingQuestion: {
                include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  return NextResponse.json({ attempt });
}
