import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Language } from "@/generated/prisma/enums";
import { gradeSql } from "@/worker/graders/sql";
import { gradeDsa } from "@/worker/graders/dsa";

interface RunBody {
  language?: unknown;
  code?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } },
  });
  if (!problem) {
    return NextResponse.json({ error: "problem not found" }, { status: 404 });
  }

  // "Run" only grades sample (non-hidden) test cases and is never persisted as
  // a Submission — it's a fast, ungraded preview before a real Submit.
  const outcome =
    problem.type === "SQL"
      ? await gradeSql(`run_${randomUUID()}`, code, problem.testCases)
      : await gradeDsa(language as Language, code, problem.testCases);

  return NextResponse.json(outcome);
}
