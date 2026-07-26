import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status === "FINALIZED") {
    return NextResponse.json({ error: "Already finalized" }, { status: 400 });
  }
  if (attempt.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Attempt hasn't been submitted yet" }, { status: 400 });
  }

  const pending = attempt.answers.filter((a) => a.gradingStatus === "PENDING");
  if (pending.length > 0) {
    return NextResponse.json(
      { error: `${pending.length} question(s) still need grading before this can be finalized` },
      { status: 400 }
    );
  }

  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });

  return NextResponse.json({ attempt: updated });
}
