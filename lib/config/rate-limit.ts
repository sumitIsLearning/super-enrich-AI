import type { Duration } from "@upstash/ratelimit";

/**
 * Reads an integer threshold from an env var, falling back to a default if
 * the var is unset or not a valid number. Keeps every numeric limit below
 * configurable from the environment instead of hardcoded in source.
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Reads a window duration (e.g. "15 m", "1 d") from an env var, falling back
 * to a default. No format validation here: values flow straight into
 * @upstash/ratelimit, which throws on a malformed string at limiter creation.
 */
function envDuration(name: string, fallback: Duration): Duration {
  return (process.env[name] as Duration | undefined) ?? fallback;
}

export const RATE_LIMIT_CONFIG = {
  // Auth routes (login, signup, password reset) — strictest tier.
  AUTH: {
    // Per-IP leg, enforced by better-auth's own built-in limiter
    // (its customRules option takes plain seconds, not a Duration string).
    IP_MAX: envInt("RATE_LIMIT_AUTH_IP_MAX", 20),
    IP_WINDOW_SECONDS: envInt("RATE_LIMIT_AUTH_IP_WINDOW_SECONDS", 900),
    // Per-account leg: exponential backoff instead of a hard lockout,
    // retry-after = min(BASE * MULTIPLIER^failures, MAX).
    BACKOFF_BASE_SECONDS: envInt("RATE_LIMIT_AUTH_BACKOFF_BASE_SECONDS", 30),
    BACKOFF_MULTIPLIER: envInt("RATE_LIMIT_AUTH_BACKOFF_MULTIPLIER", 2),
    BACKOFF_MAX_SECONDS: envInt("RATE_LIMIT_AUTH_BACKOFF_MAX_SECONDS", 3600),
  },

  // Unauthenticated endpoints reachable without a session — moderate tier.
  // (No route uses this yet; defined so one can opt in without inventing new config shape.)
  PUBLIC: {
    MAX: envInt("RATE_LIMIT_PUBLIC_MAX", 100),
    WINDOW: envDuration("RATE_LIMIT_PUBLIC_WINDOW", "1 h"),
  },

  // Authenticated user actions (enrich, chat, generate-fields, scrape) — loosest tier.
  AUTHENTICATED: {
    MAX: envInt("RATE_LIMIT_AUTHENTICATED_MAX", 50),
    WINDOW: envDuration("RATE_LIMIT_AUTHENTICATED_WINDOW", "1 d"),
  },
} as const;
