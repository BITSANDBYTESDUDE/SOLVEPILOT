import "server-only";

/**
 * Fixed-window in-memory rate limiter (Task 04).
 *
 * Scope and limits, stated honestly:
 *  - state lives in the Node.js process, so it protects a single instance.
 *    Serverless deployments get a per-invocation-instance counter, which still
 *    absorbs naive password guessing but is not a hard guarantee. Task 38
 *    (security hardening) moves this to a shared store such as Redis or
 *    Upstash, where the interface below stays the same.
 *  - it is intentionally simple: one window, one limit, automatic sweep.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts recorded in the current window, including this one. */
  attempts: number;
  limit: number;
  /** Milliseconds until the window resets. 0 when the request was allowed. */
  retryAfterMs: number;
}

interface Bucket {
  attempts: number;
  /** Absolute timestamp (ms) at which this bucket's count resets. */
  resetAt: number;
}

interface Store {
  buckets: Map<string, Bucket>;
  lastSweepAt: number;
}

// `var` is required here: ambient global declarations cannot use let/const.
declare global {
  var __solvepilotRateLimits: Map<string, Store> | undefined;
}

/**
 * Keyed by limiter name so different limits never share counters. Lives on
 * `globalThis` to survive hot reloads in development.
 */
function storeFor(name: string): Store {
  const stores = (globalThis.__solvepilotRateLimits ??= new Map<string, Store>());
  const existing = stores.get(name);
  if (existing) return existing;

  const created: Store = { buckets: new Map(), lastSweepAt: Date.now() };
  stores.set(name, created);
  return created;
}

/** Drop expired buckets occasionally so a busy process cannot grow unbounded. */
function sweep(store: Store, now: number): void {
  if (now - store.lastSweepAt < 60_000) return;
  store.lastSweepAt = now;

  for (const [key, bucket] of store.buckets) {
    if (bucket.resetAt <= now) store.buckets.delete(key);
  }
}

/**
 * Record an attempt against `key` and report whether it is still within
 * `limit` for the current `windowMs`.
 */
export function consumeRateLimit(
  name: string,
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const store = storeFor(name);
  sweep(store, now);

  const existing = store.buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    store.buckets.set(key, { attempts: 1, resetAt: now + options.windowMs });
    return { allowed: true, attempts: 1, limit: options.limit, retryAfterMs: 0 };
  }

  existing.attempts += 1;
  const allowed = existing.attempts <= options.limit;

  return {
    allowed,
    attempts: existing.attempts,
    limit: options.limit,
    retryAfterMs: allowed ? 0 : Math.max(0, existing.resetAt - now),
  };
}

/** Forget a key — called after a successful sign-in so users are not punished. */
export function resetRateLimit(name: string, key: string): void {
  storeFor(name).buckets.delete(key);
}

/** Remove every bucket for a limiter. Used by tests. */
export function clearRateLimit(name: string): void {
  storeFor(name).buckets.clear();
}

/** Best-effort client identifier. Falls back to a shared bucket when unknown. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip") ?? "unknown";
}
