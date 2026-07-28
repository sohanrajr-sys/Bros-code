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

  const submission = await prisma.submission.findUnique({ where: { id } });
  // 404 (not 403) on ownership mismatch so we don't confirm the id exists.
  if (!submission || (submission.userId !== sessionUser.userId && sessionUser.role !== "admin")) {
    return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  return NextResponse.json(submission);
}
