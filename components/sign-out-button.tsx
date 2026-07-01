"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
      className="inline-flex h-[32px] items-center justify-center rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      Sign out
    </button>
  );
}
