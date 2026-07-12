import { cookies } from "next/headers";

export type Role = "admin" | "student";

export type SessionUser = {
  userId: string;
  role: Role;
};

function readCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function resolve(role: string | null, userId: string | null): SessionUser {
  if (role === "admin" || role === "student") {
    return { userId: userId ?? (role === "admin" ? "dev-admin" : "dev-student"), role };
  }
  return { userId: "dev-student", role: "student" };
}

// TEMPORARY: replaced by real auth integration (see teammate's auth work). Only reads debug headers for now.
export function getSessionUser(req: Request): SessionUser | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const role = req.headers.get("x-debug-role") ?? readCookie(cookieHeader, "debug-role");
  const userId = req.headers.get("x-debug-user-id") ?? readCookie(cookieHeader, "debug-user-id");
  return resolve(role, userId);
}

// TEMPORARY: replaced by real auth integration (see teammate's auth work). Only reads debug headers for now.
// For server components / layouts, which get cookies via next/headers rather than a Request object.
export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  const role = store.get("debug-role")?.value ?? null;
  const userId = store.get("debug-user-id")?.value ?? null;
  return resolve(role, userId);
}
