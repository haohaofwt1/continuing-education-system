import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>Đăng nhập hệ thống</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-sm text-slate-500">Nếu chưa nối PostgreSQL, form sẽ tự vào demo mode để bạn thử chức năng ngay.</p>
        </CardContent>
      </Card>
    </div>
  );
}
