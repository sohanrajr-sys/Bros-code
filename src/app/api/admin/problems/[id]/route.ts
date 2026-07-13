import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { problemInputSchema } from "@/lib/problemSchema";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { testCases: { orderBy: { order: "asc" } } },
  });

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  return NextResponse.json({ problem });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

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

  const existing = await prisma.problem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const { testCases, functionSignature, ...problemFields } = result.data;

  try {
    const problem = await prisma.problem.update({
      where: { id },
      data: {
        ...problemFields,
        functionSignature: functionSignature ?? Prisma.JsonNull,
        testCases: {
          deleteMany: {},
          create: testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            order: tc.order,
          })),
        },
      },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ problem });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "A problem with this slug already exists" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.problem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  await prisma.problem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
