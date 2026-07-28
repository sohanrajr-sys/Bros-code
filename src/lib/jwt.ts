import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE_NAME = "session";
const EXPIRY = "7d";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches EXPIRY
};

export type SessionPayload = {
  sub: string; // User.id
  role: Role;
  name: string;
  loginId: string; // whatever they logged in with: email (admin) or studentId (student)
};

const MIN_PROD_SESSION_SECRET_LENGTH = 32;
const PLACEHOLDER_SESSION_SECRETS = new Set(["change-me-to-a-long-random-string"]);

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  if (
    process.env.NODE_ENV === "production" &&
    (secret.length < MIN_PROD_SESSION_SECRET_LENGTH || PLACEHOLDER_SESSION_SECRETS.has(secret))
  ) {
    throw new Error(
      `SESSION_SECRET is missing, a placeholder, or too short (< ${MIN_PROD_SESSION_SECRET_LENGTH} chars) ` +
        "for production. Set a long, random value before deploying.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, loginId: payload.loginId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub === "string" &&
      (payload.role === "ADMIN" || payload.role === "STUDENT") &&
      typeof payload.name === "string" &&
      typeof payload.loginId === "string"
    ) {
      return {
        sub: payload.sub,
        role: payload.role,
        name: payload.name,
        loginId: payload.loginId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
