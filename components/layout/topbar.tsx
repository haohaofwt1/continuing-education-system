"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, Command, FileCheck2, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCertificates, getEmployees } from "@/lib/demo-store";
import { certificates as seedCertificates, employees as seedEmployees } from "@/lib/mock-data";

const quickActions = [
  { label: "Tổng quan", href: "/dashboard", keywords: "dashboard tổng quan vận hành" },
  { label: "Hồ sơ nhân sự", href: "/employees", keywords: "nhân sự cchn hồ sơ" },
  { label: "Chứng chỉ", href: "/certificates", keywords: "chứng chỉ upload ocr duyệt" },
  { label: "Đào tạo liên tục", href: "/training", keywords: "chu kỳ số tiết đào tạo" },
  { label: "Báo cáo", href: "/reports", keywords: "báo cáo export thống kê" },
  { label: "Trợ lý AI", href: "/ai-assistant", keywords: "ai chatgpt openai trợ lý" },
  { label: "Cài đặt hệ thống", href: "/admin/settings", keywords: "cài đặt openai api key cấu hình" }
];

type SearchResult = {
  label: string;
  href: string;
  hint: string;
  type: string;
};

export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [employees, setEmployees] = useState(seedEmployees);
  const [certificates, setCertificates] = useState(seedCertificates);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const missingHours = employees.filter((employee) => employee.hours < employee.requiredHours);
  const missingLicense = employees.filter((employee) => !employee.licenseNumber || employee.status === "Thiếu CCHN");
  const pendingCertificates = certificates.filter((certificate) => certificate.status === "Chờ duyệt");
  const notifications = [
    { title: `${pendingCertificates.length} chứng chỉ chờ duyệt`, detail: "Mở danh sách chứng chỉ để xử lý", href: "/certificates", icon: FileCheck2 },
    { title: `${missingHours.length} nhân sự thiếu số tiết`, detail: "Kiểm tra tiến độ chu kỳ hiện tại", href: "/training", icon: Bell },
    { title: `${missingLicense.length} hồ sơ thiếu CCHN`, detail: "Cập nhật thông tin hành nghề", href: "/employees", icon: UserRound }
  ].filter((item) => !item.title.startsWith("0 "));

  const results = useMemo<SearchResult[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return quickActions.slice(0, 5).map((item) => ({ label: item.label, href: item.href, hint: "Chức năng", type: "Điều hướng" }));
    }
    const employeeResults = employees
      .filter((employee) => `${employee.name} ${employee.department} ${employee.position} ${employee.licenseNumber}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((employee) => ({ label: employee.name, href: "/employees", hint: `${employee.department} · ${employee.position}`, type: "Nhân sự" }));
    const certificateResults = certificates
      .filter((certificate) => `${certificate.title} ${certificate.holder} ${certificate.code} ${certificate.issuer}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((certificate) => ({ label: certificate.title, href: "/certificates", hint: `${certificate.holder} · ${certificate.status}`, type: "Chứng chỉ" }));
    const actionResults = quickActions
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(normalized))
      .map((item) => ({ label: item.label, href: item.href, hint: "Chức năng", type: "Điều hướng" }));
    return [...actionResults, ...employeeResults, ...certificateResults].slice(0, 8);
  }, [certificates, employees, query]);

  useEffect(() => {
    setEmployees(getEmployees());
    setCertificates(getCertificates());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setLogoutOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notificationsOpen, profileOpen]);

  const goTo = (href: string) => {
    router.push(href);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-white/82 px-4 backdrop-blur-xl lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Hệ thống Đào tạo Liên tục</div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mt-1 hidden w-full max-w-2xl items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-left shadow-sm transition hover:border-teal-300 md:flex"
        >
          <Search className="h-4 w-4 text-slate-400" />
          <span className="flex-1 text-sm text-slate-400">Tìm nhân sự, chứng chỉ, báo cáo hoặc chức năng...</span>
          <span className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-500">
            <Command className="h-3 w-3" /> K
          </span>
        </button>
      </div>

      <div ref={notificationsRef} className="relative">
        <Button variant="secondary" size="icon" aria-label="Thông báo" onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }}>
          <Bell className="h-5 w-5" />
          {notifications.length ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" /> : null}
        </Button>
        {notificationsOpen ? (
          <div className="absolute right-0 top-12 z-50 w-96 rounded-2xl border bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold text-slate-950">Thông báo</div>
              <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {notifications.length ? notifications.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} onClick={() => setNotificationsOpen(false)} className="flex gap-3 rounded-xl p-3 transition hover:bg-teal-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Icon className="h-5 w-5" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">{item.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.detail}</span>
                  </span>
                </Link>
              );
            }) : <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Không có việc cần xử lý.</div>}
          </div>
        ) : null}
      </div>

      <div ref={profileRef} className="relative hidden sm:block">
        <button type="button" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-2 shadow-sm transition hover:border-teal-300">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-900">Quản trị hệ thống</div>
            <div className="text-xs text-slate-500">Super Admin</div>
          </div>
        </button>
        {profileOpen ? (
          <div className="absolute right-0 top-14 z-50 w-80 rounded-2xl border bg-white p-3 shadow-2xl">
            <div className="rounded-xl bg-teal-50 p-4">
              <div className="text-sm font-semibold text-slate-950">Quản trị hệ thống</div>
              <div className="mt-1 text-xs text-slate-500">admin@example.com</div>
            </div>
            <div className="mt-2 grid gap-1">
              <Link href="/profile" onClick={() => setProfileOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-teal-50">Hồ sơ cá nhân</Link>
              <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-teal-50">Cài đặt hệ thống</Link>
              <Link href="/admin/accounts" onClick={() => setProfileOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-teal-50">Quản lý tài khoản</Link>
            </div>
          </div>
        ) : null}
      </div>

      <Button variant="ghost" size="icon" aria-label="Đăng xuất" onClick={() => setLogoutOpen(true)}>
        <LogOut className="h-5 w-5" />
      </Button>

      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30 p-4 backdrop-blur-sm" onMouseDown={() => setSearchOpen(false)}>
          <div className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="h-5 w-5 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus className="border-0 shadow-none focus:ring-0" placeholder="Tìm nhân sự, chứng chỉ, báo cáo, AI..." />
              <button type="button" onClick={() => setSearchOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.length ? results.map((result) => (
                <button key={`${result.href}-${result.label}`} type="button" onClick={() => goTo(result.href)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-teal-50">
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">{result.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{result.hint ?? "Điều hướng"}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{result.type ?? "Điều hướng"}</span>
                </button>
              )) : <div className="p-6 text-center text-sm text-slate-500">Không tìm thấy kết quả phù hợp.</div>}
            </div>
          </div>
        </div>
      ) : null}

      {logoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><LogOut className="h-6 w-6" /></div>
            <div className="mt-4 text-lg font-bold text-slate-950">Đăng xuất khỏi hệ thống?</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">Phiên demo sẽ chuyển về màn hình đăng nhập. Dữ liệu demo đang lưu trên trình duyệt vẫn được giữ lại.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Hủy</Button>
              <Button onClick={() => router.push("/login")}><CheckCircle2 className="h-4 w-4" />Đăng xuất</Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
