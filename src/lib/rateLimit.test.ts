import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { checkRateLimit } from "./rateLimit";
import { redisConnection } from "./redis";

// Integration test against the local docker-compose Redis (redisConnection
// defaults to redis://localhost:6380) — no mock, since rate limiting's whole
// job is coordinating atomic counters, which a mock wouldn't meaningfully test.

afterAll(async () => {
  await redisConnection.quit();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit, then blocks", async () => {
    const key = `test:${randomUUID()}`;
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await checkRateLimit(key, { limit: 3, windowSeconds: 5 }));
    }
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results.slice(3).every((r) => !r.allowed)).toBe(true);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);

    await redisConnection.del(`ratelimit:${key}`);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test:${randomUUID()}`;
    const keyB = `test:${randomUUID()}`;

    await checkRateLimit(keyA, { limit: 1, windowSeconds: 5 });
    const blockedA = await checkRateLimit(keyA, { limit: 1, windowSeconds: 5 });
    const firstB = await checkRateLimit(keyB, { limit: 1, windowSeconds: 5 });

    expect(blockedA.allowed).toBe(false);
    expect(firstB.allowed).toBe(true);

    await redisConnection.del(`ratelimit:${keyA}`, `ratelimit:${keyB}`);
  });

  it("resets once the window expires", async () => {
    const key = `test:${randomUUID()}`;
    await checkRateLimit(key, { limit: 1, windowSeconds: 1 });
    const blocked = await checkRateLimit(key, { limit: 1, windowSeconds: 1 });
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const afterWindow = await checkRateLimit(key, { limit: 1, windowSeconds: 1 });
    expect(afterWindow.allowed).toBe(true);

    await redisConnection.del(`ratelimit:${key}`);
  });
});
