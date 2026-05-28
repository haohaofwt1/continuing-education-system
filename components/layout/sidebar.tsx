"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bot, FileCheck2, GraduationCap, IdCard, LayoutDashboard, MessageCircle, Settings, ShieldCheck, Users } from "lucide-react";
import type { DemoEmployee } from "@/lib/demo-store";
import { isEmployeeRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/portal", label: "Tổng quan", icon: LayoutDashboard, employee: true },
  { href: "/portal/certificates", label: "Chứng chỉ của tôi", icon: FileCheck2, employee: true },
  { href: "/portal/profile", label: "Thông tin cá nhân", icon: IdCard, employee: true },
  { href: "/discuss", label: "Discuss", icon: MessageCircle, employee: true },
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/employees", label: "Hồ sơ nhân sự", icon: Users },
  { href: "/certificates", label: "Chứng chỉ", icon: FileCheck2 },
  { href: "/training", label: "Chu kỳ CME", icon: GraduationCap },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/discuss", label: "Discuss", icon: MessageCircle },
  { href: "/ai-assistant", label: "Trợ lý AI", icon: Bot },
  { href: "/admin", label: "Quản trị", icon: Settings }
];

export function Sidebar({ initialRole = "" }: { initialRole?: string }) {
  const pathname = usePathname();
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [cycle, setCycle] = useState<{ startYear: number; endYear: number } | null>(null);
  const [role, setRole] = useState<string>(initialRole);

  const employeeMode = isEmployeeRole(role);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        const [employeesResponse, cycleResponse] = await Promise.all([
          fetch(employeeMode ? "/api/portal/overview" : "/api/employees", { cache: "no-store" }),
          fetch("/api/training/cycles", { cache: "no-store" })
        ]);
        const employeesPayload = employeesResponse.ok ? await employeesResponse.json() as { data: DemoEmployee[] | { employee?: DemoEmployee } } : { data: [] };
        const cyclePayload = cycleResponse.ok ? await cycleResponse.json() as { data: { startYear: number; endYear: number } | null } : { data: null };
        if (!mounted) return;
        if (employeeMode && !Array.isArray(employeesPayload.data)) {
          setEmployees(employeesPayload.data.employee ? [employeesPayload.data.employee] : []);
        } else {
          setEmployees(Array.isArray(employeesPayload.data) ? employeesPayload.data : []);
        }
        setCycle(cyclePayload.data);
      } catch {
        if (!mounted) return;
        setEmployees([]);
        setCycle(null);
      }
    }

    void loadSummary();
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session: { user?: { role?: string } } | null) => setRole(session?.user?.role ?? ""))
      .catch(() => setRole(""));
    return () => {
      mounted = false;
    };
  }, [employeeMode]);

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
          <div className="text-sm font-bold uppercase tracking-wide text-teal-700">{employeeMode ? "CME Portal" : "CME System"}</div>
          <div className="text-xs text-slate-500">{employeeMode ? "Cá nhân" : "Đào tạo liên tục"}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.filter((item) => employeeMode ? item.employee : !item.employee).map((item) => {
          const active = pathname === item.href || (!item.employee && pathname.startsWith(`${item.href}/`));
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
          <Link href={employeeMode ? "/portal" : "/training"} className="rounded-xl bg-white px-3 py-2 font-semibold text-teal-700 transition hover:bg-teal-100">Xem chu kỳ</Link>
          <Link href={employeeMode ? "/portal/certificates" : "/reports"} className="rounded-xl bg-white px-3 py-2 font-semibold text-teal-700 transition hover:bg-teal-100">{employeeMode ? "Chứng chỉ" : "Báo cáo"}</Link>
        </div>
      </div>
    </aside>
  );
}
