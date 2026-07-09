import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((_path: string) => {
    throw new Error("REDIRECT");
  }),
}));

import { requireSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

describe("requireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when there is no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
    await expect(requireSession()).rejects.toThrow("REDIRECT");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/login");
  });

  it("returns the session when authenticated", async () => {
    const fakeSession = { user: { id: "u1" } };
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(fakeSession);
    await expect(requireSession()).resolves.toEqual(fakeSession);
  });
});
