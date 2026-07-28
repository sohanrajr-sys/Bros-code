"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { generateRandomPassword, hashPassword } from "@/lib/password";
import { bulkStudentCreateInputSchema } from "@/lib/authSchema";

export type CreatedStudent = { studentId: string; name: string; password: string };
export type BulkCreateState = { error?: string; created?: CreatedStudent[] };

// Parses a textarea of "studentId, name" lines (one student per line) into
// the shape bulkStudentCreateInputSchema expects.
function parseRows(raw: string): { studentId: string; name: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [studentId, ...rest] = line.split(",").map((part) => part.trim());
      return { studentId: studentId ?? "", name: rest.join(", ").trim() || studentId };
    });
}

export async function bulkCreateStudents(
  _prevState: BulkCreateState,
  formData: FormData,
): Promise<BulkCreateState> {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return { error: "Forbidden" };
  }

  const raw = formData.get("rows");
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { error: "Enter at least one student (one per line)" };
  }

  const parsed = bulkStudentCreateInputSchema.safeParse({ students: parseRows(raw) });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { students } = parsed.data;

  // All-or-nothing: pre-validate uniqueness (in-batch and against the DB)
  // before creating anything, so a duplicate row can't leave a partial batch
  // of already-shown, one-time passwords behind.
  const idsInBatch = students.map((s) => s.studentId);
  const duplicateInBatch = idsInBatch.find((id, idx) => idsInBatch.indexOf(id) !== idx);
  if (duplicateInBatch) {
    return { error: `Duplicate student ID in this batch: ${duplicateInBatch}` };
  }

  const existing = await prisma.user.findMany({
    where: { studentId: { in: idsInBatch } },
    select: { studentId: true },
  });
  if (existing.length > 0) {
    return { error: `Student ID already exists: ${existing.map((e) => e.studentId).join(", ")}` };
  }

  const toCreate = await Promise.all(
    students.map(async (s) => {
      const password = generateRandomPassword();
      const passwordHash = await hashPassword(password);
      return { ...s, password, passwordHash };
    }),
  );

  await prisma.user.createMany({
    data: toCreate.map((s) => ({
      role: "STUDENT" as const,
      studentId: s.studentId,
      name: s.name,
      passwordHash: s.passwordHash,
    })),
  });

  revalidatePath("/admin/students");

  return {
    created: toCreate.map((s) => ({ studentId: s.studentId, name: s.name, password: s.password })),
  };
}
