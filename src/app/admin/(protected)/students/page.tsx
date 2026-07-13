import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { BulkAddForm } from "./BulkAddForm";

export const dynamic = "force-dynamic";

async function getStudents() {
  return prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, studentId: true, name: true, createdAt: true },
  });
}

export default async function AdminStudentsPage() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const students = await getStudents();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Students &middot; {students.length} enrolled</h1>
        <p className="mt-1 text-sm text-text-muted">
          Admin-issued credentials &mdash; there is no student self-registration.
        </p>
      </div>

      <div className="mt-6">
        <BulkAddForm />
      </div>

      {students.length === 0 ? (
        <p className="mt-8 text-text-muted">No students yet. Add some above to get started.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between rounded-lg border border-navy-border bg-navy-900 px-4 py-3"
            >
              <div>
                <span className="font-medium text-foreground">{student.name}</span>
                <span className="ml-2 text-xs text-text-muted">{student.studentId}</span>
              </div>
              <span className="rounded bg-mint/15 px-2 py-0.5 text-xs text-mint">Active</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
