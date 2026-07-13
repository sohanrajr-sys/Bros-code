import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/jwt";
import { studentLoginInputSchema } from "@/lib/authSchema";

async function studentLogin(formData: FormData) {
  "use server";

  const parsed = studentLoginInputSchema.safeParse({
    studentId: formData.get("studentId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?error=1");
  }

  const user = await prisma.user.findUnique({
    where: { studentId: parsed.data.studentId },
  });

  if (!user || user.role !== "STUDENT" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, loginId: user.studentId! });
  (await cookies()).set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  redirect("/");
}

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-navy-border bg-navy-900 p-6">
        <h1 className="text-lg font-semibold text-foreground">Academic OS</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to continue your DSA course</p>

        <form action={studentLogin} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="studentId" className="text-sm text-text-muted">
              Student ID
            </label>
            <input
              id="studentId"
              name="studentId"
              type="text"
              autoComplete="username"
              required
              placeholder="2026-CSE-0417"
              className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground placeholder:text-text-muted/60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-text-muted">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">That ID or password doesn&apos;t match.</p>
          )}

          <button
            type="submit"
            className="min-h-[44px] rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
          >
            Sign in
          </button>

          <p className="text-center text-xs text-text-muted">
            Credentials are issued by your course administrator
          </p>
        </form>
      </div>
    </main>
  );
}
