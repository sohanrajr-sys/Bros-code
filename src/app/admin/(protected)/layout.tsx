import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/session";
import { logout } from "@/app/actions/logout";
import { Forbidden } from "@/components/admin/Forbidden";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUserFromCookies();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.role !== "admin") {
    return <Forbidden loginId={user.loginId} />;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-navy-border bg-navy-900 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <nav className="flex items-center gap-4">
            <Link href="/admin/problems" className="text-sm text-foreground hover:text-cyan">
              Problems
            </Link>
            <Link href="/admin/students" className="text-sm text-foreground hover:text-cyan">
              Students
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">
              Logged in as <span className="font-medium text-cyan">{user.loginId}</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground hover:border-cyan hover:text-cyan"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
