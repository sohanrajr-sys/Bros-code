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

  const isLoginPage = pathname === "/login";
  const isAdminPath = pathname.startsWith("/admin");

  // The login page always renders — even when already authenticated, it
  // shows a "logged in as X" banner with a log-out option instead of
  // silently bouncing the user away (see LoginPageClient).
  if (isLoginPage) {
    return NextResponse.next();
  }

  if (isAdminPath) {
    // No session at all: bounce to the login page with the admin tab
    // preselected. A session with the wrong role (a logged-in student) is
    // intentionally NOT redirected here — that case is left to the admin
    // layout, which renders a Forbidden page instead of sending an
    // already-logged-in user back to a login form they can't use.
    if (!session) {
      return NextResponse.redirect(new URL("/login?as=admin", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - Next internals (_next/static, _next/image)
     * - favicon.ico
     * - /api/** (every Route Handler does its own getSessionUser(req) check)
     */
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
