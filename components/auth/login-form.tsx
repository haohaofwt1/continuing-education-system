"use client";

import { useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        const formData = new FormData(event.currentTarget);
        const result = await signIn("credentials", {
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          redirect: false,
          callbackUrl: "/"
        });
        setLoading(false);
        if (result?.error) {
          setError("Không đăng nhập được. Hãy kiểm tra email, mật khẩu và database production.");
          return;
        }
        const session = await getSession();
        const employeeMode = ["Nhan vien", "Nhân viên", "Employee", "EMPLOYEE"].includes(session?.user?.role ?? "");
        window.location.href = employeeMode ? "/portal" : (result?.url ?? "/dashboard");
      }}
    >
      <Input name="email" type="email" defaultValue="admin@example.com" placeholder="admin@example.com" />
      <Input name="password" type="password" placeholder="Mật khẩu quản trị" />
      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div> : null}
      <Button className="w-full" type="submit" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
    </form>
  );
}
