import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submissionsQueue } from "@/lib/queue";
import { Language } from "@/generated/prisma/enums";

interface CreateSubmissionBody {
  userId?: unknown;
  language?: unknown;
  code?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: problemId } = await params;

  let body: CreateSubmissionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { userId, language, code } = body;

  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (typeof language !== "string" || !(language in Language)) {
    return NextResponse.json(
      { error: `language must be one of ${Object.keys(Language).join(", ")}` },
      { status: 400 }
    );
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) {
    return NextResponse.json({ error: "problem not found" }, { status: 404 });
  }

  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId,
      language: language as Language,
      code,
      status: "QUEUED",
    },
  });

  await submissionsQueue.add("grade", { submissionId: submission.id });

  return NextResponse.json({ submissionId: submission.id }, { status: 202 });
}
