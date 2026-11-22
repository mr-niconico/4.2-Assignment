// Per-IP rate limit for the AI routes (spec sections 5 and 8): a "sliding window" count.
// Kept in memory: on Vercel each running server instance keeps its own count, which is enough
// to stop casual abuse in v1 (no database). The clock is passed in so tests can control time.

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now: number): RateLimitResult {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    recent.push(now);
    hits.set(key, recent);

    // Housekeeping: drop keys with no recent hits so memory does not grow forever.
    if (hits.size > 5000) {
      for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
    return { allowed: true };
  };
}

/** The visitor's IP address from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
