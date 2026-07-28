import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const problem = await prisma.problem.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      difficulty: true,
      tags: true,
      type: true,
      constraints: true,
      testCases: {
        where: { isHidden: false },
        orderBy: { order: "asc" },
        select: { id: true, input: true, expectedOutput: true, order: true },
      },
      _count: { select: { testCases: { where: { isHidden: true } } } },
    },
  });

  if (!problem) {
    return NextResponse.json({ error: "problem not found" }, { status: 404 });
  }

  const { _count, ...rest } = problem;
  return NextResponse.json({ ...rest, hiddenTestCaseCount: _count.testCases });
}
