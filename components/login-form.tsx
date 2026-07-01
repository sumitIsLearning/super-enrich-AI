"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signIn, signUp } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-[40px] w-full rounded-[8px] border border-gray-300 bg-white px-[12px] text-[14px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = isSignup
      ? await signUp.email({ email, password, name })
      : await signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Authentication failed");
      return;
    }
    router.push("/");
  };

  const handleGoogle = async () => {
    setError(null);
    await signIn.social({ provider: "google", callbackURL: "/" });
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="grid overflow-hidden rounded-[16px] border border-gray-200 bg-white shadow-sm md:grid-cols-2">
        <form
          className="flex flex-col gap-[20px] p-[32px]"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col items-center gap-[4px] text-center">
            <h1 className="text-[24px] font-bold text-gray-900">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-[14px] text-gray-500">
              {isSignup
                ? "Sign up to start enriching your data"
                : "Sign in to your Super Enrich account"}
            </p>
          </div>

          {isSignup && (
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="name" className="text-[13px] font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          )}

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="email" className="text-[13px] font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="password" className="text-[13px] font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="orange" className="w-full p-20 text-lg" disabled={loading}>
            {loading ? "…" : isSignup ? "Sign up" : "Sign in"}
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
            <span className="relative bg-white px-[8px] text-[12px] text-gray-500">
              Or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="inline-flex h-[40px] w-full items-center justify-center gap-[8px] rounded-[10px] border border-gray-300 bg-white px-[16px] text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-[16px] w-[16px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Continue with Google
          </button>

          <div className="text-center text-[13px] text-gray-600">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              className="font-medium text-orange-600 underline underline-offset-4"
              onClick={() => {
                setError(null);
                setMode(isSignup ? "signin" : "signup");
              }}
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </div>
        </form>

        <div className="relative hidden bg-gradient-to-br from-orange-500 to-orange-400 md:block">
          <div className="absolute inset-0 flex flex-col justify-end gap-[8px] p-[32px] text-white">
            <h2 className="text-[24px] font-bold">Super Enrich</h2>
            <p className="text-[14px] text-white/90">
              Messy data in → clean, cited, AI-ready knowledge out.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
