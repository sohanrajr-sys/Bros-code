import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { startOrResumeAttempt } from "@/lib/quizAttempts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await startOrResumeAttempt(id, user.userId);

  switch (result.status) {
    case "not_found":
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    case "not_open":
      return NextResponse.json({ error: "This quiz hasn't opened yet" }, { status: 403 });
    case "closed":
      return NextResponse.json({ error: "This quiz has closed" }, { status: 403 });
    case "exhausted":
    case "awaiting_results":
      return NextResponse.json({ error: "You've used all your attempts for this quiz" }, { status: 403 });
    case "started":
      return NextResponse.json({ attempt: result.attempt }, { status: result.isNew ? 201 : 200 });
  }
}
