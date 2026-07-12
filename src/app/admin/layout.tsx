import { cookies } from "next/headers";
import { getSessionUserFromCookies } from "@/lib/session";

// Dev-only scaffolding: lets you flip the debug role cookie before real auth lands.
async function setDebugRole(formData: FormData) {
  "use server";
  const role = formData.get("role");
  const store = await cookies();
  if (role === "admin" || role === "student") {
    store.set("debug-role", role, { path: "/" });
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUserFromCookies();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-navy-border bg-navy-900 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-text-muted">
            Dev role switcher (temporary, until real auth lands) &mdash; current role:{" "}
            <span className="font-medium text-cyan">{user?.role ?? "student"}</span>
          </span>
          <form action={setDebugRole} className="flex items-center gap-2">
            <select
              name="role"
              defaultValue={user?.role ?? "student"}
              className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-2 text-sm text-foreground"
            >
              <option value="student">student</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground hover:border-cyan hover:text-cyan"
            >
              Set role
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
