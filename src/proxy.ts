import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/jwt";

// Optimistic redirect only — this never replaces the per-route session checks
// in Server Components/Route Handlers/Server Actions (see src/lib/session.ts
// call sites), matching this codebase's existing re-check-everywhere
// convention and the Next.js docs' own warning that Server Actions are POSTs
// to their own route, so a Proxy matcher exclusion also skips them.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  const isStudentLogin = pathname === "/login";

  // Already-logged-in users hitting a login page: bounce to their landing page.
  if (session && (isStudentLogin || isAdminLogin)) {
    return NextResponse.redirect(
      new URL(session.role === "ADMIN" ? "/admin/problems" : "/", request.url),
    );
  }

  if (isAdminPath && !isAdminLogin) {
    // No session at all: bounce to admin login. A session with the wrong role
    // (a logged-in student) is intentionally NOT redirected here — that case
    // is left to the admin layout, which renders a Forbidden page instead of
    // sending an already-logged-in user back to a login form they can't use.
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Everything else (student-facing surface) except the login pages themselves.
  if (!isStudentLogin && !isAdminLogin) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - Next internals (_next/static, _next/image)
     * - favicon.ico
     * - /api/** (Route Handlers already do their own getSessionUser(req) check)
     */
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
