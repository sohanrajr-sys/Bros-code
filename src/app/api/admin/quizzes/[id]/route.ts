import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { quizInputSchema, buildQuestionCreateInput, questionsUnchanged } from "@/lib/quizSchema";
import { weightsSumTo100 } from "@/lib/quizScoring";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json({ quiz });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.quiz.findUnique({
    where: { id },
    include: {
      _count: { select: { attempts: true } },
      questions: {
        orderBy: { order: "asc" },
        include: { mcqOptions: { orderBy: { order: "asc" } }, codingQuestion: { include: { testCases: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const result = quizInputSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body", issues: result.error.issues },
      { status: 400 }
    );
  }

  const { questions, ...quizFields } = result.data;

  // Replacing the question set would cascade-delete any existing attempts'
  // answers (QuizAnswer -> QuizQuestion is onDelete: Cascade). Once a quiz
  // has real attempts, question edits are blocked — but metadata (title,
  // schedule, etc.) can still change freely, so only reject when the
  // submitted questions actually differ from what's stored.
  const hasAttempts = existing._count.attempts > 0;
  const unchanged = hasAttempts && questionsUnchanged(questions, existing.questions);
  if (hasAttempts && !unchanged) {
    return NextResponse.json(
      {
        error: `This quiz already has ${existing._count.attempts} attempt(s) — its questions can't be edited. Only title, description, and scheduling can change.`,
      },
      { status: 400 }
    );
  }

  if (quizFields.status === "PUBLISHED") {
    if (questions.length === 0) {
      return NextResponse.json({ error: "A quiz needs at least one question to publish" }, { status: 400 });
    }
    if (!weightsSumTo100(questions.map((q) => q.weight))) {
      const total = questions.reduce((sum, q) => sum + q.weight, 0);
      return NextResponse.json({ error: `Question weights must sum to 100 (currently ${total})` }, { status: 400 });
    }
  }

  const quiz = await prisma.quiz.update({
    where: { id },
    data: {
      ...quizFields,
      // If there are attempts, `unchanged` is the only way past the guard
      // above, so the questions relation is deliberately left untouched.
      ...(hasAttempts
        ? {}
        : {
            questions: {
              deleteMany: {},
              create: questions.map((q) => buildQuestionCreateInput(q)),
            },
          }),
    },
    include: {
      questions: { include: { mcqOptions: true, codingQuestion: { include: { testCases: true } } } },
    },
  });

  return NextResponse.json({ quiz });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.quiz.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  if (existing._count.attempts > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${existing._count.attempts} student attempt(s) exist for this quiz.` },
      { status: 400 }
    );
  }

  await prisma.quiz.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
