import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/jwt";

export type Role = "admin" | "student";

export type SessionUser = {
  userId: string;
  role: Role;
  name: string;
  loginId: string; // email (admin) or Student ID (student)
};

function toSessionUser(payload: SessionPayload | null): SessionUser | null {
  if (!payload) return null;
  return {
    userId: payload.sub,
    role: payload.role === "ADMIN" ? "admin" : "student",
    name: payload.name,
    loginId: payload.loginId,
  };
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return null;
  return toSessionUser(await verifySession(token));
}

// For server components / layouts, which get cookies via next/headers rather than a Request object.
export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return toSessionUser(await verifySession(token));
}
