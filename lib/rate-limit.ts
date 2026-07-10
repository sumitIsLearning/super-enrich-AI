import { Ratelimit } from "@upstash/ratelimit";
import type { Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { RATE_LIMIT_CONFIG } from "@/lib/config/rate-limit";

export interface RateLimitTier {
  max: number;
  window: Duration;
}

/**
 * Builds an Upstash fixed-window limiter scoped to `key` (the Redis prefix)
 * and sized by `tier`. Returns null outside production when no Redis is
 * configured, so local dev/testing is never blocked by rate limits.
 */
export const getRateLimiter = (key: string, tier: RateLimitTier) => {
  // Check if we're in a production environment to apply rate limiting
  // In development, we don't want to be rate limited for testing
  if (process.env.NODE_ENV !== "production" && !process.env.UPSTASH_REDIS_REST_URL) {
    return null;
  }

  // Requires the following environment variables:
  // UPSTASH_REDIS_REST_URL
  // UPSTASH_REDIS_REST_TOKEN
  const redis = Redis.fromEnv();

  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(tier.max, tier.window),
    analytics: true,
    prefix: `ratelimit:${key}`,
  });
};

// Helper function to get the IP from a NextRequest or default to a placeholder
export const getIP = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(/, /)[0];
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Default to placeholder IP if none found
  return "127.0.0.1";
};

/**
 * Entry point route handlers call to check + consume one request against a
 * given tier, keyed by caller IP. Returns success plus limit/remaining so the
 * route can build a 429 response with the right headers when tripped.
 */
export const isRateLimited = async (request: NextRequest, key: string, tier: RateLimitTier) => {
  const limiter = getRateLimiter(key, tier);

  // If no limiter is available (e.g., in development), allow the request
  if (!limiter) {
    return { success: true, limit: tier.max, remaining: tier.max };
  }

  // Get the IP from the request
  const ip = getIP(request);

  // Check if the IP has exceeded the rate limit
  const result = await limiter.limit(ip);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
  };
};

/**
 * Same dev-bypass rule as getRateLimiter, but returns a plain Redis client
 * for the backoff functions below (they need direct get/set/ttl, not a
 * fixed-window limiter).
 */
function getBackoffRedis(): Redis | null {
  if (process.env.NODE_ENV !== "production" && !process.env.UPSTASH_REDIS_REST_URL) {
    return null;
  }
  return Redis.fromEnv();
}

/**
 * Records one failed auth attempt for an IP+account pair, then sets a
 * "blocked until" window that grows exponentially with each failure
 * (base * multiplier^failures, capped) instead of a hard lockout.
 */
export const recordAuthFailure = async (ip: string, accountKey: string): Promise<void> => {
  const redis = getBackoffRedis();
  if (!redis) return;

  const compositeKey = `${ip}:${accountKey}`;
  const { BACKOFF_BASE_SECONDS, BACKOFF_MULTIPLIER, BACKOFF_MAX_SECONDS } = RATE_LIMIT_CONFIG.AUTH;

  const failures = await redis.incr(`authfail:count:${compositeKey}`);
  await redis.expire(`authfail:count:${compositeKey}`, BACKOFF_MAX_SECONDS);

  const backoffSeconds = Math.min(
    BACKOFF_BASE_SECONDS * Math.pow(BACKOFF_MULTIPLIER, failures - 1),
    BACKOFF_MAX_SECONDS
  );
  await redis.set(`authfail:blocked:${compositeKey}`, "1", { ex: backoffSeconds });
};

/**
 * Checks whether an IP+account pair is currently inside its backoff window.
 * Returns the remaining seconds so the caller can send a real Retry-After
 * header instead of guessing or blocking permanently.
 */
export const checkAuthBackoff = async (
  ip: string,
  accountKey: string
): Promise<{ blocked: boolean; retryAfterSeconds: number }> => {
  const redis = getBackoffRedis();
  if (!redis) return { blocked: false, retryAfterSeconds: 0 };

  const compositeKey = `${ip}:${accountKey}`;
  const ttl = await redis.ttl(`authfail:blocked:${compositeKey}`);

  return ttl > 0 ? { blocked: true, retryAfterSeconds: ttl } : { blocked: false, retryAfterSeconds: 0 };
};

/**
 * Clears backoff state for an IP+account pair after a successful auth
 * attempt, so a legitimate login isn't penalized by earlier failures.
 * Call this from the auth success path only.
 */
export const clearAuthBackoff = async (ip: string, accountKey: string): Promise<void> => {
  const redis = getBackoffRedis();
  if (!redis) return;

  const compositeKey = `${ip}:${accountKey}`;
  await redis.del(`authfail:count:${compositeKey}`, `authfail:blocked:${compositeKey}`);
};
