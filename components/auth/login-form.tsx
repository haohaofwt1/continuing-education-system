"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
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
          callbackUrl: "/dashboard"
        });
        setLoading(false);
        if (result?.error) {
          window.localStorage.setItem("cme.demo.session", JSON.stringify({ email: String(formData.get("email") ?? ""), role: "Super Admin", mode: "demo" }));
          window.location.href = "/dashboard";
          return;
        }
        window.location.href = result?.url ?? "/dashboard";
      }}
    >
      <Input name="email" type="email" defaultValue="admin@example.com" />
      <Input name="password" type="password" defaultValue="ChangeMe123!" />
      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div> : null}
      <Button className="w-full" type="submit" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
    </form>
  );
}
