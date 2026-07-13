import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/session";
import { logout } from "@/app/actions/logout";
import { Forbidden } from "@/components/admin/Forbidden";
import { AdminNav } from "@/components/admin/AdminNav";

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
          <AdminNav />
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">
              Logged in as <span className="font-medium text-cyan">{user.loginId}</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
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
