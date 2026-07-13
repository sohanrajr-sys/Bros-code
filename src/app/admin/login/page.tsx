import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/jwt";
import { adminLoginInputSchema } from "@/lib/authSchema";

async function adminLogin(formData: FormData) {
  "use server";

  const parsed = adminLoginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/admin/login?error=1");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || user.role !== "ADMIN" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/admin/login?error=1");
  }

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, loginId: user.email! });
  (await cookies()).set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  redirect("/admin/problems");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-navy-border bg-navy-950 p-6">
        <span className="inline-block rounded bg-navy-800 px-2 py-0.5 text-xs uppercase tracking-wide text-text-muted">
          Admin
        </span>
        <h1 className="mt-2 text-lg font-semibold text-foreground">Academic OS</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to manage the DSA course</p>

        <form action={adminLogin} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-text-muted">
              Admin email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="priya@contentops.edu"
              className="min-h-[44px] rounded border border-navy-border bg-navy-900 px-3 text-sm text-foreground placeholder:text-text-muted/60"
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
              className="min-h-[44px] rounded border border-navy-border bg-navy-900 px-3 text-sm text-foreground"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">That email or password doesn&apos;t match.</p>
          )}

          <button
            type="submit"
            className="min-h-[44px] rounded bg-foreground px-4 text-sm font-medium text-navy-950 hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
