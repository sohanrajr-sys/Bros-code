import { redisConnection } from "@/lib/redis";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Fixed-window counter keyed by an arbitrary string (caller namespaces it,
// e.g. "login:identifier:studentId" or "run:userId"). INCR is atomic, so
// concurrent requests can't race past the limit; EXPIRE is only set on the
// window's first hit so later increments don't keep pushing the window out.
export async function checkRateLimit(key: string, { limit, windowSeconds }: RateLimitOptions): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const count = await redisConnection.incr(redisKey);
  if (count === 1) {
    await redisConnection.expire(redisKey, windowSeconds);
  }
  if (count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const ttl = await redisConnection.ttl(redisKey);
  return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
}
