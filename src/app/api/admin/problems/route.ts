import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { problemInputSchema } from "@/lib/problemSchema";

export async function GET(req: Request) {
  const user = getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const problems = await prisma.problem.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      type: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { testCases: true } },
    },
  });

  return NextResponse.json({ problems });
}

export async function POST(req: Request) {
  const user = getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const result = problemInputSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body", issues: result.error.issues },
      { status: 400 },
    );
  }

  const { testCases, ...problemFields } = result.data;

  try {
    const problem = await prisma.problem.create({
      data: {
        ...problemFields,
        createdBy: user.userId,
        testCases: {
          create: testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            order: tc.order,
          })),
        },
      },
      include: { testCases: true },
    });

    return NextResponse.json({ problem }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "A problem with this slug already exists" }, { status: 400 });
    }
    throw err;
  }
}
