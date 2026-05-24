"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bot, FileCheck2, GraduationCap, LayoutDashboard, MessageCircle, Settings, ShieldCheck, Users } from "lucide-react";
import type { DemoEmployee } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/employees", label: "Hồ sơ nhân sự", icon: Users },
  { href: "/certificates", label: "Chứng chỉ", icon: FileCheck2 },
  { href: "/training", label: "Đào tạo liên tục", icon: GraduationCap },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/discuss", label: "Discuss", icon: MessageCircle },
  { href: "/ai-assistant", label: "Trợ lý AI", icon: Bot },
  { href: "/admin", label: "Quản trị", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [cycle, setCycle] = useState<{ startYear: number; endYear: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        const [employeesResponse, cycleResponse] = await Promise.all([
          fetch("/api/employees", { cache: "no-store" }),
          fetch("/api/training/cycles", { cache: "no-store" })
        ]);
        const employeesPayload = employeesResponse.ok ? await employeesResponse.json() as { data: DemoEmployee[] } : { data: [] };
        const cyclePayload = cycleResponse.ok ? await cycleResponse.json() as { data: { startYear: number; endYear: number } | null } : { data: null };
        if (!mounted) return;
        setEmployees(Array.isArray(employeesPayload.data) ? employeesPayload.data : []);
        setCycle(cyclePayload.data);
      } catch {
        if (!mounted) return;
        setEmployees([]);
        setCycle(null);
      }
    }

    void loadSummary();
    return () => {
      mounted = false;
    };
  }, []);

  const totalRequiredHours = employees.reduce((sum, employee) => sum + employee.requiredHours, 0);
  const totalHours = employees.reduce((sum, employee) => sum + Math.min(employee.hours, employee.requiredHours), 0);
  const progress = totalRequiredHours ? Math.round((totalHours / totalRequiredHours) * 100) : 0;
  const completed = employees.filter((employee) => employee.hours >= employee.requiredHours && employee.licenseNumber).length;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-white/88 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/20">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-teal-700">CME System</div>
          <div className="text-xs text-slate-500">Đào tạo liên tục</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition",
                active ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20" : "hover:bg-teal-50 hover:text-teal-700"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-4 rounded-2xl border bg-teal-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-teal-900">{cycle ? `Chu kỳ ${cycle.startYear}-${cycle.endYear}` : "Chưa cấu hình chu kỳ"}</div>
            <div className="mt-1 text-xs text-teal-700">{completed}/{employees.length} hồ sơ đạt yêu cầu</div>
          </div>
          <div className="rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-teal-700">{progress}%</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white">
          <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Link href="/training" className="rounded-xl bg-white px-3 py-2 font-semibold text-teal-700 transition hover:bg-teal-100">Xem chu kỳ</Link>
          <Link href="/reports" className="rounded-xl bg-white px-3 py-2 font-semibold text-teal-700 transition hover:bg-teal-100">Báo cáo</Link>
        </div>
      </div>
    </aside>
  );
}
