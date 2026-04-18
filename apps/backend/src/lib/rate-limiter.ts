/**
 * Per-user sliding window rate limiter (in-memory).
 *
 * Limits how many AI messages a user can send within a rolling time window.
 * Uses a simple Map — no external dependencies required right now.
 * When Redis is available (BullMQ phase), swap the store to ioredis + INCR/EXPIRE.
 *
 * Defaults (overridable via env):
 *   RATE_LIMIT_WINDOW_MS    = 3_600_000  (1 hour)
 *   RATE_LIMIT_MAX_REQUESTS = 30
 */

type Window = {
  count: number;
  windowStart: number;
};

const windows = new Map<string, Window>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 3_600_000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30);

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
};

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(userId);

  // First request or window expired — open a new window
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    windows.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  // Window still active — check limit
  if (existing.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: existing.windowStart + WINDOW_MS };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    resetAt: existing.windowStart + WINDOW_MS,
  };
}

/** Exposed for health checks / admin endpoints. */
export function activeWindowCount(): number {
  return windows.size;
}
