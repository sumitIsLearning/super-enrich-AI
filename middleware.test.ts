import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

vi.mock("better-auth/cookies", () => ({ getSessionCookie: vi.fn() }));

describe("middleware", () => {
  beforeEach(() => vi.mocked(getSessionCookie).mockReset());

  it("redirects unauthenticated requests to /login", () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);
    const res = middleware(new NextRequest(new URL("http://localhost:3000/super-enrich")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("passes authenticated requests through", () => {
    vi.mocked(getSessionCookie).mockReturnValue("session-token");
    const res = middleware(new NextRequest(new URL("http://localhost:3000/")));
    expect(res.headers.get("location")).toBeNull();
  });
});
