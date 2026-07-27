import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { Language } from "@/generated/prisma/enums";
import { gradeDsa } from "@/worker/graders/dsa";

interface RunBody {
  language?: unknown;
  code?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; questionId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId, questionId } = await params;

  let body: RunBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { language, code } = body;
  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (typeof language !== "string" || !(language in Language)) {
    return NextResponse.json(
      { error: `language must be one of ${Object.keys(Language).join(", ")}` },
      { status: 400 }
    );
  }

  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "This attempt is no longer in progress" }, { status: 409 });
  }

  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: {
      codingQuestion: {
        include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } },
      },
    },
  });
  if (!question || question.quizId !== attempt.quizId || question.type !== "CODING" || !question.codingQuestion) {
    return NextResponse.json({ error: "Coding question not found" }, { status: 404 });
  }

  // Same contract as /api/problems/[id]/run: grades sample (non-hidden) test
  // cases only and is never persisted — a fast, ungraded preview before the
  // quiz-wide Submit.
  try {
    const outcome = await gradeDsa(
      language as Language,
      code,
      question.codingQuestion.testCases,
      question.codingQuestion.functionSignature
    );
    return NextResponse.json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Execution failed: ${message}` }, { status: 502 });
  }
}
