"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Download, Edit3, Eye, KeyRound, Link2, Plus, QrCode, RefreshCw, Search, Trash2, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departments, positions } from "@/lib/mock-data";
import { DemoEmployee, downloadCsv, getEmployees, saveEmployees } from "@/lib/demo-store";

type CategoryKind = "Khoa/phòng" | "Chức danh" | "Loại chứng chỉ" | "Đơn vị cấp" | "Chu kỳ đào tạo";
type CategoryItem = {
  id: string;
  kind: CategoryKind;
  name: string;
  status: "Hoạt động" | "Tạm khóa";
  note: string;
  code?: string;
  parentName?: string;
  managerName?: string;
  policyName?: string;
  requiredHours?: number;
  annualMinimumHours?: number;
  requiresLicense?: boolean;
};
type AuditItem = { id: string; actor: string; action: string; module: string; target: string; at: string; ip: string };
type ApiKeyItem = { id: string; name: string; maskedKey: string; status: "Hoạt động" | "Tạm khóa"; lastUsed: string; createdAt: string };
type QrItem = { id: string; name: string; type: "Chứng chỉ" | "Báo cáo"; url: string; createdBy: string; expiresAt: string; status: "Hoạt động" | "Hết hạn" };

const roles = ["Super Admin", "Admin đơn vị", "Quản lý khoa/phòng", "Nhân viên", "Người rà soát báo cáo", "Người chỉ xem báo cáo"];
const accountStatuses = ["Hoạt động", "Thiếu CCHN", "Tạm khóa"];
const categoryKinds: CategoryKind[] = ["Khoa/phòng", "Chức danh", "Loại chứng chỉ", "Đơn vị cấp", "Chu kỳ đào tạo"];

const categorySeed: CategoryItem[] = [
  ...departments.map((name, index) => ({ id: `dep-${index}`, kind: "Khoa/phòng" as CategoryKind, name, code: `KP${String(index + 1).padStart(2, "0")}`, managerName: "", status: "Hoạt động" as const, note: "Đơn vị chịu trách nhiệm theo dõi nhân sự và nhắc việc" })),
  ...positions.map((name, index) => ({ id: `pos-${index}`, kind: "Chức danh" as CategoryKind, name, code: `CD${String(index + 1).padStart(2, "0")}`, policyName: "CME 120 tiết / 5 năm", requiredHours: 120, annualMinimumHours: 12, requiresLicense: true, status: "Hoạt động" as const, note: "Gán chính sách tuân thủ mặc định cho nhân sự" })),
  ...["Cập nhật kiến thức y khoa liên tục", "Kiểm soát nhiễm khuẩn", "Cấp cứu", "An toàn người bệnh"].map((name, index) => ({ id: `type-${index}`, kind: "Loại chứng chỉ" as CategoryKind, name, status: "Hoạt động" as const, note: "Loại chứng chỉ" })),
  ...["Bệnh viện Trung tâm", "Sở Y tế", "Trường Đại học Y Dược"].map((name, index) => ({ id: `issuer-${index}`, kind: "Đơn vị cấp" as CategoryKind, name, status: "Hoạt động" as const, note: "Đơn vị cấp chứng chỉ" })),
  { id: "cycle-2024", kind: "Chu kỳ đào tạo", name: "Chu kỳ cá nhân 5 năm", code: "CME-5Y", status: "Hoạt động", note: "120 tiết / 5 năm, tối thiểu 12 tiết mỗi năm" }
];

const auditSeed: AuditItem[] = [
  { id: "a1", actor: "admin@example.com", action: "Tạo chứng chỉ", module: "Chứng chỉ", target: "CERT-2026-001", at: "2026-05-21 08:30", ip: "127.0.0.1" },
  { id: "a2", actor: "system", action: "Tự động tính tín chỉ", module: "Chứng chỉ", target: "CERT-2026-002", at: "2026-05-21 09:05", ip: "127.0.0.1" },
  { id: "a3", actor: "system", action: "Import nhân sự", module: "Nhân sự", target: "10 dòng", at: "2026-05-20 17:40", ip: "127.0.0.1" },
  { id: "a4", actor: "admin@example.com", action: "Cập nhật cài đặt", module: "Cài đặt", target: "Chu kỳ 2025-2026", at: "2026-05-20 21:12", ip: "127.0.0.1" }
];

const apiKeySeed: ApiKeyItem[] = [
  { id: "k1", name: "OCR integration", maskedKey: "cme_live_••••••••••••8KQ2", status: "Hoạt động", lastUsed: "Chưa sử dụng", createdAt: "2026-05-20" }
];

const qrSeed: QrItem[] = [
  { id: "q1", name: "Xác minh CERT-2026-001", type: "Chứng chỉ", url: "/verify/certificate/CERT-2026-001", createdBy: "admin@example.com", expiresAt: "2026-12-31", status: "Hoạt động" },
  { id: "q2", name: "Báo cáo đào tạo 2026", type: "Báo cáo", url: "/reports?shared=2026", createdBy: "admin@example.com", expiresAt: "2026-12-31", status: "Hoạt động" }
];

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function AccountsAdminClient() {
  const [items, setItems] = useState<DemoEmployee[]>(() => getEmployees());
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<DemoEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DemoEmployee | null>(null);
  const [notice, setNotice] = useState("");
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/accounts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("accounts unavailable")))
      .then((payload: { data: DemoEmployee[] }) => {
        if (!Array.isArray(payload.data)) return;
        setItems(payload.data);
        setDatabaseReady(true);
        setNotice("Tài khoản đang được tải từ database.");
      })
      .catch(() => {
        setDatabaseReady(false);
        setNotice("Database chưa sẵn sàng, tài khoản đang hiển thị từ dữ liệu demo trên trình duyệt.");
      });
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.name} ${item.email} ${item.phone} ${item.role} ${item.department}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!role || item.role === role) && (!status || item.status === status);
  }), [items, query, role, status]);
  const { pageItems, pageStart, pageEnd, totalPages, currentPage } = paginate(filtered, page, pageSize);

  const persist = (next: DemoEmployee[], message: string) => {
    setItems(next);
    saveEmployees(next);
    setNotice(message);
  };

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const next: DemoEmployee = {
      ...editing,
      id: editing.id || `u${Date.now()}`,
      name: String(form.get("name") ?? ""),
      username: String(form.get("username") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      department: String(form.get("department") ?? ""),
      position: String(form.get("position") ?? ""),
      role: String(form.get("role") ?? ""),
      licenseNumber: editing.licenseNumber,
      status: String(form.get("status") ?? ""),
      hours: editing.hours ?? 0,
      requiredHours: editing.requiredHours ?? 48
    };
    const exists = items.some((item) => item.id === next.id);
    if (databaseReady) {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice("Chưa lưu được tài khoản vào database. Kiểm tra email/tên đăng nhập có bị trùng không.");
        return;
      }
      const saved = payload.data as DemoEmployee;
      persist(exists ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items], "Đã lưu tài khoản vào database.");
      setEditing(null);
      return;
    }
    persist(exists ? items.map((item) => item.id === next.id ? next : item) : [next, ...items], "Đã lưu tài khoản trong trình duyệt.");
    setEditing(null);
  };

  const bulkStatus = async (nextStatus: string) => {
    if (databaseReady) {
      await Promise.all(selectedIds.map((id) =>
        fetch("/api/admin/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "status", status: nextStatus })
        })
      ));
    }
    persist(items.map((item) => selectedIds.includes(item.id) ? { ...item, status: nextStatus } : item), `Đã cập nhật ${selectedIds.length} tài khoản.`);
    setSelectedIds([]);
  };

  const resetPassword = async (account: DemoEmployee) => {
    if (!databaseReady) {
      setNotice("Database chưa sẵn sàng nên chưa reset mật khẩu thật được.");
      return;
    }
    const response = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, action: "reset-password" })
    });
    const payload = await response.json();
    if (!response.ok) {
      setNotice("Chưa reset được mật khẩu. Kiểm tra database và quyền quản trị.");
      return;
    }
    setNotice(`Mật khẩu mới cho ${account.email}: ${payload.password}`);
  };

  const deleteAccount = async (account: DemoEmployee) => {
    if (databaseReady) {
      const response = await fetch(`/api/admin/accounts?id=${encodeURIComponent(account.id)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice("Chưa khóa/xóa được tài khoản trong database.");
        return;
      }
      persist(items.map((item) => item.id === account.id ? { ...item, status: "Tạm khóa" } : item), "Đã tạm khóa tài khoản trong database.");
      setDeleteTarget(null);
      return;
    }
    persist(items.filter((item) => item.id !== account.id), "Đã xóa tài khoản demo.");
    setDeleteTarget(null);
  };

  const emptyAccount: DemoEmployee = { id: "", name: "", username: "", email: "", phone: "", department: departments[0], position: positions[0], role: "Nhân viên", licenseNumber: "", status: "Hoạt động", hours: 0, requiredHours: 48 };

  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Tài khoản" description="Quản lý user, vai trò, trạng thái, reset mật khẩu và khóa/mở tài khoản." actions={<Button onClick={() => setEditing(emptyAccount)}><Plus className="h-4 w-4" />Thêm tài khoản</Button>} />
      <Notice text={notice} />
      <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${databaseReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
        {databaseReady ? "Danh sách tài khoản đang load từ database. Reset mật khẩu sẽ cập nhật passwordHash thật." : "Database chưa sẵn sàng, đang hiển thị dữ liệu demo trong trình duyệt."}
      </div>
      <AdminToolbar>
        <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Tìm tên, email, vai trò..." />
        <Select value={role} onChange={(value) => { setRole(value); setPage(1); }} options={["", ...roles]} labels={{ "": "Tất cả vai trò" }} />
        <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...accountStatuses]} labels={{ "": "Tất cả trạng thái" }} />
        <Button variant="ghost" onClick={() => { setQuery(""); setRole(""); setStatus(""); }}>Xóa lọc</Button>
      </AdminToolbar>
      {selectedIds.length ? <BulkBar count={selectedIds.length} onClear={() => setSelectedIds([])} actions={<><Button size="sm" variant="secondary" onClick={() => bulkStatus("Hoạt động")}>Kích hoạt</Button><Button size="sm" variant="secondary" onClick={() => bulkStatus("Tạm khóa")}>Tạm khóa</Button></>} /> : null}
      {editing ? <AccountForm account={editing} onSubmit={saveAccount} onCancel={() => setEditing(null)} /> : null}
      <PageLine label="tài khoản" start={pageStart} end={pageEnd} total={filtered.length} page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      <Card className="mt-4 overflow-hidden">
        <Table>
          <thead className="bg-teal-50 text-xs uppercase text-slate-500"><tr><th className="p-4"><input type="checkbox" checked={pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id))} onChange={() => togglePage(pageItems.map((item) => item.id), selectedIds, setSelectedIds)} className="h-4 w-4 accent-teal-600" /></th><th>Tài khoản</th><th>Khoa/phòng</th><th>Chức danh</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody className="divide-y bg-white">{pageItems.map((item) => <tr key={item.id} className="hover:bg-teal-50/40"><td className="p-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id, setSelectedIds)} className="h-4 w-4 accent-teal-600" /></td><td><div className="flex items-center gap-3"><Avatar /><div><div className="font-semibold">{item.name}</div><div className="text-xs text-slate-500">{item.email} · {item.phone}</div></div></div></td><td>{item.department}</td><td>{item.position}</td><td>{item.role}</td><td><StatusBadge status={item.status} /></td><td><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => void resetPassword(item)}><RefreshCw className="h-4 w-4" />Reset</Button><Button size="icon" variant="ghost" onClick={() => setEditing(item)}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody>
        </Table>
      </Card>
      {deleteTarget ? <ConfirmDialog title="Khóa tài khoản này?" description="Với database thật, thao tác này sẽ tạm khóa tài khoản để giữ lịch sử. Chế độ demo sẽ xóa khỏi localStorage." onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteAccount(deleteTarget)} /> : null}
    </>
  );
}

export function CategoriesAdminClient() {
  const [items, setItems] = useState<CategoryItem[]>(() => readLocal("cme.demo.categories", categorySeed));
  const [kind, setKind] = useState<CategoryKind | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [notice, setNotice] = useState("");
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/catalog", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("catalog unavailable")))
      .then((payload: { data: CategoryItem[] }) => {
        if (!Array.isArray(payload.data)) return;
        const databaseItems = payload.data;
        const localOnly = readLocal("cme.demo.categories", categorySeed).filter((item) => !["Khoa/phòng", "Chức danh"].includes(item.kind));
        setItems([...databaseItems, ...localOnly]);
        setDatabaseReady(true);
      })
      .catch(() => {
        setDatabaseReady(false);
        setNotice("Database chưa sẵn sàng, danh mục đang chạy ở chế độ demo trên trình duyệt.");
      });
  }, []);

  const filtered = items.filter((item) => (!kind || item.kind === kind) && (!query || `${item.name} ${item.kind} ${item.note}`.toLowerCase().includes(query.toLowerCase())));
  const { pageItems, pageStart, pageEnd, totalPages, currentPage } = paginate(filtered, page, pageSize);
  const persist = (next: CategoryItem[], message: string) => { setItems(next); writeLocal("cme.demo.categories", next); setNotice(message); };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const next: CategoryItem = {
      ...editing,
      id: editing.id || `cat-${Date.now()}`,
      kind: String(form.get("kind")) as CategoryKind,
      code: String(form.get("code") ?? ""),
      name: String(form.get("name") ?? ""),
      parentName: String(form.get("parentName") ?? ""),
      managerName: String(form.get("managerName") ?? ""),
      policyName: String(form.get("policyName") ?? ""),
      requiredHours: Number(form.get("requiredHours") || 0),
      annualMinimumHours: Number(form.get("annualMinimumHours") || 0),
      requiresLicense: form.get("requiresLicense") === "on",
      status: String(form.get("status")) as CategoryItem["status"],
      note: String(form.get("note") ?? "")
    };
    if (["Khoa/phòng", "Chức danh"].includes(next.kind) && databaseReady) {
      const response = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice("Chưa lưu được vào database. Kiểm tra tên/mã có bị trùng hoặc danh mục đang được sử dụng.");
        return;
      }
      const saved = payload.data as CategoryItem;
      persist(items.some((item) => item.id === saved.id) ? items.map((item) => item.id === saved.id ? { ...next, ...saved } : item) : [{ ...next, ...saved }, ...items], "Đã lưu danh mục vào database.");
      setEditing(null);
      return;
    }

    persist(items.some((item) => item.id === next.id) ? items.map((item) => item.id === next.id ? next : item) : [next, ...items], databaseReady ? "Đã lưu danh mục demo." : "Đã lưu danh mục trong trình duyệt.");
    setEditing(null);
  };

  const deleteCategory = async (item: CategoryItem) => {
    if (["Khoa/phòng", "Chức danh"].includes(item.kind) && databaseReady) {
      const response = await fetch(`/api/admin/catalog?id=${encodeURIComponent(item.id)}&kind=${encodeURIComponent(item.kind)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice("Chưa xóa được. Danh mục có thể đang được nhân sự hoặc chứng chỉ sử dụng.");
        return;
      }
    }
    persist(items.filter((entry) => entry.id !== item.id), "Đã xóa danh mục.");
    setDeleteTarget(null);
  };

  const bulkStatus = (nextStatus: CategoryItem["status"]) => {
    persist(items.map((item) => selectedIds.includes(item.id) ? { ...item, status: nextStatus } : item), `Đã cập nhật ${selectedIds.length} danh mục.`);
    setSelectedIds([]);
  };

  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Danh mục tổ chức" description="Quản lý khoa/phòng, chức danh và chính sách đào tạo để tự gán chu kỳ tuân thủ cho nhân sự." actions={<Button onClick={() => setEditing({ id: "", kind: kind || "Khoa/phòng", name: "", status: "Hoạt động", note: "" })}><Plus className="h-4 w-4" />Thêm danh mục</Button>} />
      <Notice text={notice} />
      <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${databaseReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
        {databaseReady ? "Khoa/Phòng và Chức danh đang lưu trực tiếp vào database." : "Database chưa bật, thay đổi tạm lưu ở trình duyệt."}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit overflow-hidden">
          <CardContent className="p-3">
            <button type="button" onClick={() => { setKind(""); setPage(1); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold ${kind === "" ? "bg-teal-600 text-white" : "hover:bg-teal-50"}`}>
              <span>Tất cả danh mục</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{items.length}</span>
            </button>
            <div className="mt-2 space-y-1">
              {categoryKinds.map((itemKind) => {
                const count = items.filter((item) => item.kind === itemKind).length;
                return (
                  <button key={itemKind} type="button" onClick={() => { setKind(itemKind); setPage(1); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${kind === itemKind ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}>
                    <span>{itemKind}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm tên, nhóm, ghi chú..." />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing({ id: "", kind: kind || "Khoa/phòng", name: "", status: "Hoạt động", note: "" })}><Plus className="h-4 w-4" />Thêm</Button>
                <Button variant="ghost" onClick={() => { setQuery(""); setKind(""); setPage(1); }}>Xóa lọc</Button>
              </div>
            </CardContent>
          </Card>

          {selectedIds.length ? <BulkBar count={selectedIds.length} onClear={() => setSelectedIds([])} actions={<><Button size="sm" variant="secondary" onClick={() => bulkStatus("Hoạt động")}>Kích hoạt</Button><Button size="sm" variant="secondary" onClick={() => bulkStatus("Tạm khóa")}>Tạm khóa</Button></>} /> : null}
          {editing ? <CategoryForm item={editing} onSubmit={save} onCancel={() => setEditing(null)} /> : null}

          <PageLine label="danh mục" start={pageStart} end={pageEnd} total={filtered.length} page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
          <Card className="mt-4 overflow-hidden">
            <Table>
              <thead className="sticky top-0 bg-teal-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4"><input type="checkbox" checked={pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id))} onChange={() => togglePage(pageItems.map((item) => item.id), selectedIds, setSelectedIds)} className="h-4 w-4 accent-teal-600" /></th>
                  <th>Mã</th><th>Tên danh mục</th><th>Nhóm</th><th>Chính sách / phụ trách</th><th>Yêu cầu</th><th>Trạng thái</th><th className="pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {pageItems.map((item) => (
                  <tr key={item.id} className="hover:bg-teal-50/40">
                    <td className="p-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id, setSelectedIds)} className="h-4 w-4 accent-teal-600" /></td>
                    <td className="py-3 font-semibold text-slate-600">{item.code || "Chưa có"}</td>
                    <td className="font-semibold text-slate-950"><div>{item.name}</div><div className="mt-1 text-xs font-normal text-slate-500">{item.note || "Chưa có ghi chú"}</div></td>
                    <td>{item.kind}</td>
                    <td className="max-w-md text-slate-600">{item.kind === "Khoa/phòng" ? (item.managerName || "Chưa gán phụ trách") : (item.policyName || "Chưa gán policy")}</td>
                    <td>{item.requiredHours ? `${item.requiredHours} tiết${item.annualMinimumHours ? ` · ${item.annualMinimumHours}/năm` : ""}` : "Theo cấu hình"}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="pr-4"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setEditing(item)} aria-label="Sửa"><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)} aria-label="Xóa"><Trash2 className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
      {deleteTarget ? <ConfirmDialog title="Xóa danh mục này?" description="Không nên xóa danh mục đang được chứng chỉ/nhân sự sử dụng trong dữ liệu thật." onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteCategory(deleteTarget)} /> : null}
    </>
  );
}

export function AuditLogsAdminClient() {
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = auditSeed.filter((item) => (!query || `${item.actor} ${item.action} ${item.target}`.toLowerCase().includes(query.toLowerCase())) && (!module || item.module === module));
  const { pageItems, pageStart, pageEnd, totalPages, currentPage } = paginate(filtered, page, pageSize);
  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Lịch sử hoạt động" description="Audit log chỉ cho xem/lọc/export, không cho sửa hoặc xóa để giữ tính toàn vẹn." actions={<Button variant="secondary" onClick={() => downloadCsv("audit-log.csv", filtered)}><Download className="h-4 w-4" />Export</Button>} />
      <AdminToolbar><SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Tìm actor, hành động, đối tượng..." /><Select value={module} onChange={(value) => { setModule(value); setPage(1); }} options={["", "Chứng chỉ", "Nhân sự", "Cài đặt"]} labels={{ "": "Tất cả module" }} /></AdminToolbar>
      <PageLine label="log" start={pageStart} end={pageEnd} total={filtered.length} page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      <Card className="mt-4 overflow-hidden"><Table><thead className="bg-teal-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Module</th><th>Đối tượng</th><th>IP</th></tr></thead><tbody className="divide-y bg-white">{pageItems.map((item) => <tr key={item.id}><td className="p-4">{item.at}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.module}</td><td>{item.target}</td><td>{item.ip}</td></tr>)}</tbody></Table></Card>
    </>
  );
}

export function ApiKeysAdminClient() {
  const [items, setItems] = useState<ApiKeyItem[]>(() => readLocal("cme.demo.apiKeys", apiKeySeed));
  const [newKey, setNewKey] = useState("");
  const [editingName, setEditingName] = useState("");
  const [notice, setNotice] = useState("");
  const persist = (next: ApiKeyItem[], message: string) => { setItems(next); writeLocal("cme.demo.apiKeys", next); setNotice(message); };
  const create = () => {
    const secret = `cme_live_${crypto.randomUUID().replaceAll("-", "")}`;
    const item: ApiKeyItem = { id: `k-${Date.now()}`, name: editingName || "API key mới", maskedKey: `${secret.slice(0, 9)}••••••••••••${secret.slice(-4)}`, status: "Hoạt động", lastUsed: "Chưa sử dụng", createdAt: new Date().toISOString().slice(0, 10) };
    persist([item, ...items], "Đã tạo API key. Secret chỉ hiển thị một lần trong demo.");
    setNewKey(secret);
    setEditingName("");
  };
  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Quản lý API key" description="Tạo, mask, kiểm tra và xóa API key. Dữ liệu thật cần hash secret trước khi lưu." actions={<Button onClick={create}><KeyRound className="h-4 w-4" />Tạo API key</Button>} />
      <Notice text={notice} />
      {newKey ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="font-semibold">Secret mới, chỉ hiển thị một lần:</div><div className="mt-2 flex items-center gap-2 font-mono">{newKey}<Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(newKey)}><Copy className="h-4 w-4" />Copy</Button></div></div> : null}
      <Card><CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_auto]"><Input value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="Tên API key, ví dụ OCR integration" /><Button onClick={create}><Plus className="h-4 w-4" />Tạo</Button></CardContent></Card>
      <div className="mt-4 space-y-3">{items.map((item) => <Card key={item.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><div className="font-semibold">{item.name}</div><div className="mt-1 font-mono text-sm text-slate-500">{item.maskedKey}</div><div className="mt-1 text-xs text-slate-500">Tạo {item.createdAt} · {item.lastUsed}</div></div><div className="flex items-center gap-2"><StatusBadge status={item.status} /><Button variant="secondary" size="sm" onClick={() => persist(items.map((key) => key.id === item.id ? { ...key, status: key.status === "Hoạt động" ? "Tạm khóa" : "Hoạt động" } : key), "Đã cập nhật trạng thái API key.")}>{item.status === "Hoạt động" ? "Tạm khóa" : "Kích hoạt"}</Button><Button variant="ghost" size="icon" onClick={() => persist(items.filter((key) => key.id !== item.id), "Đã xóa API key.")}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>)}</div>
    </>
  );
}

export function QrAdminClient() {
  const [items, setItems] = useState<QrItem[]>(() => readLocal("cme.demo.qr", qrSeed));
  const [notice, setNotice] = useState("");
  const persist = (next: QrItem[], message: string) => { setItems(next); writeLocal("cme.demo.qr", next); setNotice(message); };
  const create = () => persist([{ id: `q-${Date.now()}`, name: "Link xác minh mới", type: "Chứng chỉ", url: "/verify/certificate/NEW", createdBy: "admin@example.com", expiresAt: "2026-12-31", status: "Hoạt động" }, ...items], "Đã tạo QR/link mock.");
  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Quản lý QR" description="Quản lý link xác minh chứng chỉ và báo cáo chia sẻ." actions={<Button onClick={create}><QrCode className="h-4 w-4" />Tạo QR/link</Button>} />
      <Notice text={notice} />
      <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <Card key={item.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase text-teal-700">{item.type}</div><h3 className="mt-2 text-lg font-bold">{item.name}</h3><div className="mt-2 text-sm text-slate-500">{item.url}</div><div className="mt-1 text-xs text-slate-500">Tạo bởi {item.createdBy} · hết hạn {item.expiresAt}</div></div><StatusBadge status={item.status} /></div><div className="mt-5 flex gap-2"><Button asChild size="sm" variant="secondary"><Link href={item.url}><Eye className="h-4 w-4" />Mở</Link></Button><Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${item.url}`)}><Link2 className="h-4 w-4" />Copy link</Button><Button size="sm" variant="ghost" onClick={() => persist(items.filter((qr) => qr.id !== item.id), "Đã xóa QR/link.")}><Trash2 className="h-4 w-4" />Xóa</Button></div></CardContent></Card>)}</div>
    </>
  );
}

function AccountForm({ account, onSubmit, onCancel }: { account: DemoEmployee; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <Card className="mt-4"><CardContent className="p-5"><form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3"><Field label="Họ tên"><Input name="name" defaultValue={account.name} required /></Field><Field label="Tên đăng nhập"><Input name="username" defaultValue={account.username} required /></Field><Field label="Email"><Input name="email" defaultValue={account.email} required /></Field><Field label="Điện thoại"><Input name="phone" defaultValue={account.phone} /></Field><Field label="Khoa/phòng"><Select name="department" defaultValue={account.department} options={departments} /></Field><Field label="Chức danh"><Select name="position" defaultValue={account.position} options={positions} /></Field><Field label="Vai trò"><Select name="role" defaultValue={account.role} options={roles} /></Field><Field label="Trạng thái"><Select name="status" defaultValue={account.status} options={accountStatuses} /></Field><div className="flex items-end gap-2"><Button type="submit"><Check className="h-4 w-4" />Lưu</Button><Button type="button" variant="secondary" onClick={onCancel}><X className="h-4 w-4" />Hủy</Button></div></form></CardContent></Card>;
}

function CategoryForm({ item, onSubmit, onCancel }: { item: CategoryItem; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4">
          <Field label="Nhóm"><Select name="kind" defaultValue={item.kind} options={categoryKinds} /></Field>
          <Field label="Mã"><Input name="code" defaultValue={item.code || ""} placeholder="VD: KP01, BS, CME-5Y" /></Field>
          <Field label="Tên danh mục"><Input name="name" defaultValue={item.name} required /></Field>
          <Field label="Trạng thái"><Select name="status" defaultValue={item.status} options={["Hoạt động", "Tạm khóa"]} /></Field>
          <Field label="Khoa/phòng cha"><Input name="parentName" defaultValue={item.parentName || ""} /></Field>
          <Field label="Người phụ trách"><Input name="managerName" defaultValue={item.managerName || ""} /></Field>
          <Field label="Chính sách đào tạo"><Input name="policyName" defaultValue={item.policyName || ""} placeholder="CME 120 tiết / 5 năm" /></Field>
          <Field label="Ghi chú"><Input name="note" defaultValue={item.note} /></Field>
          <Field label="Số tiết yêu cầu"><Input name="requiredHours" type="number" min={0} defaultValue={item.requiredHours || ""} /></Field>
          <Field label="Tối thiểu mỗi năm"><Input name="annualMinimumHours" type="number" min={0} defaultValue={item.annualMinimumHours || ""} /></Field>
          <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input name="requiresLicense" type="checkbox" defaultChecked={item.requiresLicense ?? true} className="h-4 w-4 accent-teal-600" />
            Yêu cầu CCHN
          </label>
          <div className="md:col-span-4 flex gap-2">
            <Button type="submit"><Check className="h-4 w-4" />Lưu</Button>
            <Button type="button" variant="secondary" onClick={onCancel}><X className="h-4 w-4" />Hủy</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminToolbar({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="grid gap-3 p-5 md:grid-cols-4">{children}</CardContent></Card>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" placeholder={placeholder} /></div>;
}

function Select({ options, labels, value, onChange, name, defaultValue }: { options: string[]; labels?: Record<string, string>; value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string }) {
  return <select name={name} value={value} defaultValue={defaultValue} onChange={(event) => onChange?.(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">{options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}</select>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[980px] text-left text-sm">{children}</table></div>;
}

function Notice({ text }: { text: string }) {
  return text ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{text}</div> : null;
}

function BulkBar({ count, actions, onClear }: { count: number; actions: React.ReactNode; onClear: () => void }) {
  return <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 text-sm shadow-sm"><span className="font-semibold text-slate-700">Đã chọn {count}</span>{actions}<Button size="sm" variant="ghost" onClick={onClear}>Bỏ chọn</Button></div>;
}

function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onClick={onCancel}><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="border-b p-5"><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div><div className="flex justify-end gap-2 bg-slate-50 p-4"><Button variant="secondary" onClick={onCancel}>Hủy</Button><Button variant="destructive" onClick={onConfirm}><Trash2 className="h-4 w-4" />Xóa</Button></div></div></div>;
}

function Avatar() {
  return <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><UserRound className="h-5 w-5" /></div>;
}

function PageLine({ label, start, end, total, page, totalPages, pageSize, onPageChange, onPageSizeChange }: { label: string; start: number; end: number; total: number; page: number; totalPages: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
  return <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600"><span>Hiển thị {total ? start + 1 : 0}-{end} / {total} {label}</span><PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /></div>;
}

function PaginationControls({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: { page: number; totalPages: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
  return <div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-xl border bg-white px-2 text-sm">{[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/trang</option>)}</select><span>{page}/{totalPages}</span><Button variant="secondary" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button><Button variant="secondary" size="icon" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button></div>;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = items.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, items.length);
  return { pageItems: items.slice(pageStart, pageEnd), pageStart, pageEnd, totalPages, currentPage };
}

function toggleOne(id: string, setIds: React.Dispatch<React.SetStateAction<string[]>>) {
  setIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
}

function togglePage(pageIds: string[], selectedIds: string[], setIds: React.Dispatch<React.SetStateAction<string[]>>) {
  const allSelected = pageIds.every((id) => selectedIds.includes(id));
  setIds(allSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
}
