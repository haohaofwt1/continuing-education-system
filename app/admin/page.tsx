import { Activity, ArrowRight, Database, KeyRound, ListChecks, LockKeyhole, QrCode, Settings, Shield, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const modules = [
  { title: "Tài khoản", href: "/admin/accounts", icon: Users, description: "User, vai trò, trạng thái, reset mật khẩu.", count: "10 user", owner: "Security", status: "Hoạt động" },
  { title: "Danh mục", href: "/admin/categories", icon: ListChecks, description: "Khoa/phòng, chức danh, loại chứng chỉ, chu kỳ.", count: "18 mục", owner: "Master data", status: "Hoạt động" },
  { title: "Lịch sử hoạt động", href: "/admin/audit-logs", icon: Shield, description: "Ai tạo/sửa/xóa gì, thời gian, dữ liệu trước/sau.", count: "4 log", owner: "Audit", status: "Hoạt động" },
  { title: "Quản lý QR", href: "/admin/qr", icon: QrCode, description: "Link xác minh chứng chỉ và báo cáo chia sẻ.", count: "2 link", owner: "Public", status: "Hoạt động" },
  { title: "Quản lý API", href: "/admin/api-keys", icon: KeyRound, description: "Tạo, mask, kiểm tra, xóa API key.", count: "1 key", owner: "Integration", status: "Hoạt động" },
  { title: "Production readiness", href: "/admin/health", icon: Activity, description: "Kiểm tra DB, auth, storage, AI, realtime trước deploy.", count: "6 checks", owner: "Platform", status: "Cần bổ sung" },
  { title: "Cài đặt", href: "/admin/settings", icon: Settings, description: "Chu kỳ, logo, màu thương hiệu, OCR/storage provider.", count: "6 nhóm", owner: "System", status: "Hoạt động" }
];

const health = [
  { label: "Phân quyền", value: "6 vai trò", icon: LockKeyhole },
  { label: "Dữ liệu demo", value: "Đã đồng bộ", icon: Database },
  { label: "Tác vụ hệ thống", value: "Ổn định", icon: Activity }
];

export default function AdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Quản trị hệ thống"
        title="Control Center"
        description="Một màn hình gọn để quản lý tài khoản, danh mục, audit, QR, API và cấu hình vận hành."
        actions={<Button asChild><Link href="/admin/settings"><Settings className="h-4 w-4" />Cài đặt hệ thống</Link></Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950">Module quản trị</h2>
                  <p className="mt-1 text-sm text-slate-500">Truy cập nhanh các khu vực cần cấu hình và kiểm soát.</p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{modules.length} module</span>
              </div>
            </div>
            <div className="divide-y">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.title}
                    href={module.href}
                    className="group grid gap-3 px-5 py-4 transition hover:bg-teal-50/60 md:grid-cols-[1fr_120px_140px_110px_40px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-teal-100 text-teal-700 ring-1 ring-teal-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950">{module.title}</div>
                        <div className="mt-1 truncate text-sm text-slate-500">{module.description}</div>
                      </div>
                    </div>
                    <div className="self-center text-sm font-semibold text-slate-700">{module.count}</div>
                    <div className="self-center text-sm text-slate-500">{module.owner}</div>
                    <div className="self-center"><StatusBadge status={module.status} /></div>
                    <div className="hidden self-center justify-self-end text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-700 md:block">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-sm font-semibold uppercase text-teal-700">Tình trạng nền tảng</div>
              <div className="mt-4 space-y-3">
                {health.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><Icon className="h-4 w-4" /></div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.value}</div>
                        </div>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="text-sm font-semibold uppercase text-teal-700">Việc nên kiểm tra</div>
              <div className="mt-4 space-y-3 text-sm">
                <Link href="/admin/accounts" className="flex items-center justify-between rounded-2xl border px-4 py-3 transition hover:border-teal-300 hover:bg-teal-50">
                  <span>Rà soát tài khoản tạm khóa</span><ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link href="/admin/api-keys" className="flex items-center justify-between rounded-2xl border px-4 py-3 transition hover:border-teal-300 hover:bg-teal-50">
                  <span>Kiểm tra API key chưa sử dụng</span><ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
                <Link href="/admin/audit-logs" className="flex items-center justify-between rounded-2xl border px-4 py-3 transition hover:border-teal-300 hover:bg-teal-50">
                  <span>Xem audit log hôm nay</span><ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
