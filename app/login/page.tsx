import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-[24px]">
      <div className="w-full max-w-[880px]">
        <LoginForm />
      </div>
    </div>
  );
}
