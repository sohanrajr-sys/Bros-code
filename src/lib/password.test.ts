import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateRandomPassword, getDummyPasswordHash } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("salts each hash differently, even for identical input", async () => {
    const [a, b] = await Promise.all([hashPassword("same-input"), hashPassword("same-input")]);
    expect(a).not.toBe(b);
  });
});

describe("generateRandomPassword", () => {
  it("generates a password of the requested length", () => {
    expect(generateRandomPassword(16)).toHaveLength(16);
  });

  it("defaults to length 12", () => {
    expect(generateRandomPassword()).toHaveLength(12);
  });

  it("only uses characters from the visually-unambiguous alphabet", () => {
    const password = generateRandomPassword(200);
    expect(password).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/);
  });
});

describe("getDummyPasswordHash", () => {
  it("memoizes to the same hash across calls", async () => {
    const [a, b] = await Promise.all([getDummyPasswordHash(), getDummyPasswordHash()]);
    expect(a).toBe(b);
  });

  it("is a usable bcrypt hash that no real caller-controlled password matches", async () => {
    const dummyHash = await getDummyPasswordHash();
    expect(await verifyPassword("password123", dummyHash)).toBe(false);
  });
});
