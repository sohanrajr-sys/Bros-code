import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "./jwt";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-only-secret-not-for-production-use-1234567890";
});

function testSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

describe("signSession / verifySession", () => {
  it("round-trips a valid payload", async () => {
    const payload = { sub: "user-1", role: "STUDENT" as const, name: "Test Student", loginId: "student1" };
    const token = await signSession(payload);
    expect(await verifySession(token)).toEqual(payload);
  });

  it("rejects garbage input", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ sub: "user-1", role: "ADMIN", name: "Admin", loginId: "admin@example.com" });
    const tampered = token.slice(0, -4) + (token.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    expect(await verifySession(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ role: "STUDENT", name: "Test", loginId: "student1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 500)
      .sign(testSecret());
    expect(await verifySession(expiredToken)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const wrongSecretToken = await new SignJWT({ role: "STUDENT", name: "Test", loginId: "student1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("a-completely-different-secret"));
    expect(await verifySession(wrongSecretToken)).toBeNull();
  });

  it("rejects a well-signed token with a malformed payload (missing role)", async () => {
    const badToken = await new SignJWT({ name: "Test", loginId: "student1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(testSecret());
    expect(await verifySession(badToken)).toBeNull();
  });

  it("rejects a well-signed token with an invalid role value", async () => {
    const badToken = await new SignJWT({ role: "SUPERUSER", name: "Test", loginId: "student1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(testSecret());
    expect(await verifySession(badToken)).toBeNull();
  });
});
