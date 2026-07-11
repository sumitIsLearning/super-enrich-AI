import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getIp, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { checkAuthBackoff, clearAuthBackoff, recordAuthFailure, redisSecondaryStorage } from "@/lib/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/config/rate-limit";

const authIpRule = { window: RATE_LIMIT_CONFIG.AUTH.IP_WINDOW_SECONDS, max: RATE_LIMIT_CONFIG.AUTH.IP_MAX };

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {}),
  },
  secondaryStorage: redisSecondaryStorage,
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    customRules: {
      "/sign-in/email": authIpRule,
      "/sign-up/email": authIpRule,
      "/forget-password": authIpRule,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;

      const ip = getIp(ctx.request, ctx.context.options) ?? "127.0.0.1";
      const { blocked, retryAfterSeconds } = await checkAuthBackoff(ip, email);
      if (blocked) {
        throw new APIError(
          "TOO_MANY_REQUESTS",
          { message: "Too many failed sign-in attempts. Try again later." },
          { "Retry-After": String(retryAfterSeconds) }
        );
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = (ctx.body as { email?: string } | undefined)?.email;
      if (!email) return;

      const ip = getIp(ctx.request, ctx.context.options) ?? "127.0.0.1";
      if (isAPIError(ctx.context.returned)) {
        await recordAuthFailure(ip, email);
      } else {
        await clearAuthBackoff(ip, email);
      }
    }),
  },
});
