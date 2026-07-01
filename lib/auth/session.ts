import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Server-component / server-action guard: redirects to /login when unauthenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** API-route guard: returns a 401 Response when unauthenticated, otherwise null. */
export async function requireApiSession(headers: Headers): Promise<Response | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  return null;
}
