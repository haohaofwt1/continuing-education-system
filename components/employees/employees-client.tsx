"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Columns3, Download, FileUp, Grid2X2, ImageUp, List, Plus, Save, Search, Trash2, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoEmployee, downloadCsv } from "@/lib/demo-store";
import { deleteEmployeeFromApi, saveEmployeeToApi } from "@/lib/api-client";

const statuses = ["Hoạt động", "Thiếu CCHN", "Tạm khóa"];
const defaultDepartments = ["Phòng khám", "Phòng xét nghiệm", "Phòng Dược"];
const defaultPositions = ["Bác sĩ", "Dược sĩ", "Điều dưỡng", "Kỹ thuật viên"];
type ViewMode = "list" | "grid" | "kanban";
type DeleteTarget = { type: "single"; employee: DemoEmployee } | { type: "bulk"; ids: string[] };

const emptyEmployee: DemoEmployee = {
  id: "",
  name: "",
  username: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  role: "Nhân viên",
  licenseNumber: "",
  licenseIssuedAt: "",
  status: "Hoạt động",
  hours: 0,
  requiredHours: 48,
  avatarUrl: ""
};

export function EmployeesClient() {
  const [items, setItems] = useState<DemoEmployee[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editing, setEditing] = useState<DemoEmployee | null>(null);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    fetch("/api/employees")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload: { data: DemoEmployee[] }) => {
        setItems(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (deepLinkHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    const q = params.get("q");
    if (q && !query) setQuery(q);
    if (!editId) {
      deepLinkHandledRef.current = true;
      return;
    }
    const target = items.find((item) => item.id === editId);
    if (!target) return;
    setEditing(target);
    setPage(1);
    deepLinkHandledRef.current = true;
  }, [items, query]);

  const persist = (next: DemoEmployee[], message: string) => {
    setItems(next);
    setNotice(message);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = items.filter((employee) => {
      const haystack = `${employee.name} ${employee.email} ${employee.phone} ${employee.licenseNumber} ${employee.department} ${employee.position}`.toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!department || employee.department === department) &&
        (!position || employee.position === position) &&
        (!status || employee.status === status)
      );
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortConfig.key];
        const bVal = (b as Record<string, unknown>)[sortConfig.key];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const aComparable = typeof aVal === "number" ? aVal : String(aVal ?? "");
        const bComparable = typeof bVal === "number" ? bVal : String(bVal ?? "");
        if (aComparable < bComparable) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aComparable > bComparable) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [department, items, position, query, status, sortConfig]);

  const departmentOptions = useMemo(() => Array.from(new Set([...defaultDepartments, ...items.map((item) => item.department).filter(Boolean)])).sort((a, b) => a.localeCompare(b)), [items]);
  const positionOptions = useMemo(() => Array.from(new Set([...defaultPositions, ...items.map((item) => item.position).filter(Boolean)])).sort((a, b) => a.localeCompare(b)), [items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);

  const resetFilters = () => {
    setQuery("");
    setDepartment("");
    setPosition("");
    setStatus("");
    setPage(1);
  };

  const submitEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    const avatarFile = formData.get("avatarFile");
    const avatarUrl = avatarFile instanceof File && avatarFile.size > 0 ? await fileToDataUrl(avatarFile) : editing.avatarUrl;
    const nextEmployee: DemoEmployee = {
      ...editing,
      id: editing.id || `u${Date.now()}`,
      name: String(formData.get("name") ?? ""),
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      department: String(formData.get("department") ?? ""),
      position: String(formData.get("position") ?? ""),
      role: String(formData.get("role") ?? ""),
      licenseNumber: String(formData.get("licenseNumber") ?? ""),
      licenseIssuedAt: String(formData.get("licenseIssuedAt") ?? ""),
      status: String(formData.get("status") ?? ""),
      hours: Number(formData.get("hours") ?? 0),
      requiredHours: Number(formData.get("requiredHours") ?? 48),
      avatarUrl
    };
    const exists = items.some((item) => item.id === nextEmployee.id);
    try {
      const saved = await saveEmployeeToApi(nextEmployee, exists);
      persist(exists ? items.map((item) => (item.id === nextEmployee.id ? saved : item)) : [saved, ...items], "Đã lưu hồ sơ nhân sự.");
      setEditing(null);
    } catch {
      setNotice("Chưa lưu được hồ sơ vì hệ thống chưa kết nối được cơ sở dữ liệu. Hãy khởi động PostgreSQL hoặc cấu hình DATABASE_URL trước khi nhập dữ liệu thật.");
    }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean).slice(1);
    const imported = rows.map((row, index) => {
      const [name, email, departmentName, positionName, licenseNumber] = row.split(",").map((cell) => cell?.replaceAll("\"", "").trim());
      return {
        ...emptyEmployee,
        id: `import-${Date.now()}-${index}`,
        name: name || `Nhân sự import ${index + 1}`,
        username: email?.split("@")[0] || `import${index + 1}`,
        email: email || `import${index + 1}@example.com`,
        department: departmentName || "",
        position: positionName || "",
        licenseNumber: licenseNumber || ""
      };
    });
    if (imported.length) {
      try {
        const saved = await Promise.all(imported.map((employee) => saveEmployeeToApi(employee, false)));
        persist([...saved, ...items], `Đã import ${saved.length} nhân sự.`);
      } catch {
        setNotice("Chưa import được vì hệ thống chưa kết nối được cơ sở dữ liệu. Hãy khởi động PostgreSQL hoặc cấu hình DATABASE_URL trước.");
      }
    }
  };

  const selectedRows = selectedIds.length ? items.filter((item) => selectedIds.includes(item.id)) : filtered;

  const moveToStatus = async (employeeId: string, nextStatus: string) => {
    const target = items.find((item) => item.id === employeeId);
    if (target) await saveEmployeeToApi({ ...target, status: nextStatus }, true);
    persist(items.map((item) => item.id === employeeId ? { ...item, status: nextStatus } : item), `Đã chuyển nhân sự sang "${nextStatus}".`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "single") {
      await deleteEmployeeFromApi(deleteTarget.employee.id);
      persist(items.filter((item) => item.id !== deleteTarget.employee.id), "Đã xóa nhân sự.");
      setSelectedIds((ids) => ids.filter((id) => id !== deleteTarget.employee.id));
    } else {
      await Promise.all(deleteTarget.ids.map(deleteEmployeeFromApi));
      persist(items.filter((item) => !deleteTarget.ids.includes(item.id)), `Đã xóa ${deleteTarget.ids.length} nhân sự.`);
      setSelectedIds([]);
    }
    setDeleteTarget(null);
  };

  const bulkUpdateStatus = async (nextStatus: string) => {
    if (!selectedIds.length) return;
    const nextItems = items.map((item) => selectedIds.includes(item.id) ? { ...item, status: nextStatus } : item);
    const selected = items.filter((item) => selectedIds.includes(item.id));
    await Promise.all(selected.map((item) => saveEmployeeToApi({ ...item, status: nextStatus }, true)));
    persist(nextItems, `Đã cập nhật trạng thái cho ${selectedIds.length} nhân sự.`);
    setSelectedIds([]);
  };

  return (
    <>
      <PageHeader
        eyebrow="Hồ sơ nhân sự"
        title="Quản lý nhân sự và CCHN"
        description="Quản lý hồ sơ nhân sự, khoa/phòng, chức danh, CCHN và trạng thái đào tạo liên tục."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" />Import CSV</Button>
            <Button variant="secondary" onClick={() => downloadCsv(selectedIds.length ? "nhan-su-da-chon.csv" : "nhan-su-dang-hien-thi.csv", selectedRows)}><Download className="h-4 w-4" />{selectedIds.length ? `Export ${selectedIds.length} đã chọn` : "Export"}</Button>
            <Button onClick={() => setEditing({ ...emptyEmployee })}><Plus className="h-4 w-4" />Thêm nhân sự</Button>
          </>
        }
      />

      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<UserRound className="h-6 w-6 text-teal-700" />} value={`${items.length}`} label="Tổng nhân sự" />
        <MetricCard icon={<BarChart3 className="h-6 w-6 text-emerald-700" />} value={`${items.filter(i => i.status === "Hoạt động").length}`} label="Đang hoạt động" />
        <MetricCard icon={<X className="h-6 w-6 text-amber-700" />} value={`${items.filter(i => !i.licenseNumber).length}`} label="Chưa có CCHN" />
        <MetricCard icon={<Search className="h-6 w-6 text-sky-700" />} value={`${filtered.length}`} label="Nhân sự đang lọc" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm theo tên, email, số CCHN..." />
            </div>
            <Select value={department} onChange={(value) => { setDepartment(value); setPage(1); }} options={["", ...departmentOptions]} labels={{ "": "Tất cả khoa/phòng" }} />
            <Select value={position} onChange={(value) => { setPosition(value); setPage(1); }} options={["", ...positionOptions]} labels={{ "": "Tất cả chức danh" }} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...statuses]} labels={{ "": "Tất cả trạng thái" }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>Xóa lọc</Button>
            </div>
            <div className="flex rounded-xl border bg-white p-1">
              <ViewButton active={viewMode === "list"} onClick={() => setViewMode("list")} label="List"><List className="h-4 w-4" /></ViewButton>
              <ViewButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} label="Grid"><Grid2X2 className="h-4 w-4" /></ViewButton>
              <ViewButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} label="Kanban"><Columns3 className="h-4 w-4" /></ViewButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 text-sm shadow-sm">
          <span className="font-semibold text-slate-700">Đã chọn {selectedIds.length}</span>
          <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("Hoạt động")}>Kích hoạt</Button>
          <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("Tạm khóa")}>Tạm khóa</Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: "bulk", ids: selectedIds })}>Xóa</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
        </div>
      ) : null}

      {editing ? <EmployeeForm employee={editing} departmentOptions={departmentOptions} positionOptions={positionOptions} onSubmit={submitEmployee} onCancel={() => setEditing(null)} /> : null}

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Hiển thị {filtered.length ? pageStart + 1 : 0}-{pageEnd} / {filtered.length} nhân sự</span>
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </div>

      {viewMode === "list" ? (
        <EmployeeList
          employees={paged}
          selectedIds={selectedIds}
          sortConfig={sortConfig}
          onSort={(key) => {
            setSortConfig((prev) => {
              if (prev?.key === key) {
                return prev.direction === "asc" ? { key, direction: "desc" } : null;
              }
              return { key, direction: "asc" };
            });
          }}
          onToggle={(id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onToggleAll={() => {
            const pageIds = paged.map((employee) => employee.id);
            const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
            setSelectedIds(allPageSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
          }}
          onEdit={setEditing}
          onDelete={(employee) => setDeleteTarget({ type: "single", employee })}
        />
      ) : null}

      {viewMode === "grid" ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {paged.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} onEdit={() => setEditing(employee)} onDelete={() => setDeleteTarget({ type: "single", employee })} />
          ))}
        </div>
      ) : null}

      {viewMode === "kanban" ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {statuses.map((column) => (
            <div
              key={column}
              className="min-h-[420px] w-80 flex-none rounded-2xl border bg-slate-50 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const employeeId = event.dataTransfer.getData("text/plain");
                if (employeeId) moveToStatus(employeeId, column);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">{column}</div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{filtered.filter((item) => item.status === column).length}</span>
              </div>
              <div className="space-y-3">
                {paged.filter((item) => item.status === column).map((employee) => (
                  <button
                    key={employee.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", employee.id)}
                    onClick={() => setEditing(employee)}
                    className="w-full cursor-grab rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar employee={employee} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950">{employee.name}</div>
                        <div className="truncate text-sm text-slate-500">{employee.position}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{employee.department}</div>
                    <div className="mt-2 text-sm font-semibold">{employee.hours}/{employee.requiredHours} tiết</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {deleteTarget ? <DeleteEmployeeDialog target={deleteTarget} employees={items} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} /> : null}
      <div className="mt-5 flex justify-end">
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </div>
    </>
  );
}

function EmployeeForm({
  employee,
  departmentOptions,
  positionOptions,
  onSubmit,
  onCancel
}: {
  employee: DemoEmployee;
  departmentOptions: string[];
  positionOptions: string[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [selectedPosition, setSelectedPosition] = useState(employee.position);
  const [requiredHours, setRequiredHours] = useState(employee.requiredHours || requiredHoursForPosition(employee.position));

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="rounded-2xl border bg-teal-50/50 p-4 md:col-span-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Avatar employee={employee} size="lg" />
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-teal-200 transition hover:bg-teal-50">
                <ImageUp className="h-4 w-4" />
                Chọn ảnh nhân sự
                <input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Họ tên"><Input name="name" defaultValue={employee.name} required /></Field>
            <Field label="Tên đăng nhập"><Input name="username" defaultValue={employee.username} required /></Field>
            <Field label="Email"><Input name="email" defaultValue={employee.email} type="email" required /></Field>
            <Field label="Số điện thoại"><Input name="phone" defaultValue={employee.phone} /></Field>
            <Field label="Khoa/phòng">
              <select name="department" defaultValue={employee.department} className="h-10 w-full rounded-xl border bg-white px-3 text-sm">
                <option value="">Chưa phân khoa/phòng</option>
                {departmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Chức danh">
              <select
                name="position"
                value={selectedPosition}
                onChange={(event) => {
                  const nextPosition = event.target.value;
                  setSelectedPosition(nextPosition);
                  setRequiredHours(requiredHoursForPosition(nextPosition));
                }}
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">Chưa chọn chức danh</option>
                {positionOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Vai trò hệ thống"><Input name="role" defaultValue={employee.role} /></Field>
            <Field label="Số CCHN"><Input name="licenseNumber" defaultValue={employee.licenseNumber} placeholder="Ví dụ: CCHN-1001" /></Field>
            <Field label="Ngày cấp CCHN / ngày bắt đầu chu kỳ"><Input name="licenseIssuedAt" type="date" defaultValue={employee.licenseIssuedAt ?? ""} /></Field>
            <Field label="Trạng thái tài khoản">
              <select name="status" defaultValue={employee.status} className="h-10 w-full rounded-xl border bg-white px-3 text-sm">{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            </Field>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Số tiết đào tạo liên tục</div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Số tiết đã duyệt trong chu kỳ">
                <Input name="hours" defaultValue={employee.hours || ""} type="number" min={0} placeholder="Tự tính từ chứng chỉ đã duyệt" />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">Có thể để trống khi thêm mới. Khi có chứng chỉ đã duyệt, hệ thống sẽ cộng tự động theo ngày tín chỉ và chu kỳ cá nhân.</p>
              </Field>
              <Field label="Số tiết yêu cầu theo chức danh">
                <Input name="requiredHours" value={requiredHours} onChange={(event) => setRequiredHours(Number(event.target.value))} type="number" min={0} />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">Tự gợi ý theo chức danh/policy. Với chu kỳ 5 năm có thể dùng 120 tiết và tối thiểu 12 tiết mỗi năm.</p>
              </Field>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit"><Save className="h-4 w-4" />Lưu</Button>
            <Button type="button" variant="secondary" onClick={onCancel}><X className="h-4 w-4" />Hủy</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EmployeeList({ 
  employees, 
  selectedIds, 
  sortConfig,
  onSort,
  onToggle, 
  onToggleAll, 
  onEdit, 
  onDelete 
}: { 
  employees: DemoEmployee[]; 
  selectedIds: string[]; 
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  onToggle: (id: string) => void; 
  onToggleAll: () => void; 
  onEdit: (employee: DemoEmployee) => void; 
  onDelete: (employee: DemoEmployee) => void 
}) {
  const allChecked = employees.length > 0 && employees.every((employee) => selectedIds.includes(employee.id));
  
  const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
    <th 
      className="cursor-pointer px-4 py-4 transition hover:text-teal-700"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <BarChart3 className={`h-3 w-3 transition ${sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? 'text-teal-600' : 'rotate-180 text-teal-600') : 'opacity-20'}`} />
      </div>
    </th>
  );

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-teal-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4"><input type="checkbox" checked={allChecked} onChange={onToggleAll} className="h-4 w-4 rounded accent-teal-600" aria-label="Chọn tất cả" /></th>
              <SortHeader label="Nhân sự" sortKey="name" />
              <SortHeader label="Khoa/phòng" sortKey="department" />
              <SortHeader label="Chức danh" sortKey="position" />
              <SortHeader label="Vai trò" sortKey="role" />
              <SortHeader label="Số CCHN" sortKey="licenseNumber" />
              <SortHeader label="Số tiết" sortKey="hours" />
              <SortHeader label="Trạng thái" sortKey="status" />
              <th className="pr-5">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-teal-50/40">
                <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(employee.id)} onChange={() => onToggle(employee.id)} className="h-4 w-4 rounded accent-teal-600" aria-label={`Chọn ${employee.name}`} /></td>
                <td className="py-4 px-4"><div className="flex items-center gap-3"><Avatar employee={employee} /><div><div className="font-semibold text-slate-950">{employee.name}</div><div className="text-xs text-slate-500">{employee.email} · {employee.phone}</div></div></div></td>
                <td className="px-4">{employee.department}</td>
                <td className="px-4">{employee.position}</td>
                <td className="px-4">{employee.role}</td>
                <td className="px-4">{employee.licenseNumber || "Chưa cập nhật"}</td>
                <td className="px-4"><div className="font-semibold">{employee.hours}/{employee.requiredHours}</div><div className="mt-1 h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.min((employee.hours / employee.requiredHours) * 100, 100)}%` }} /></div></td>
                <td className="px-4"><StatusBadge status={employee.status} /></td>
                <td className="pr-5"><div className="flex gap-1"><Button asChild variant="ghost" size="sm"><Link href={`/employees/${employee.id}`}>Chi tiết</Link></Button><Button variant="ghost" size="sm" onClick={() => onEdit(employee)}>Sửa</Button><Button variant="ghost" size="icon" onClick={() => onDelete(employee)} aria-label="Xóa"><Trash2 className="h-4 w-4" /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <Card><CardContent className="p-5">{icon}<div className="mt-3 text-2xl font-bold">{value}</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>;
}

function EmployeeCard({ employee, onEdit, onDelete }: { employee: DemoEmployee; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="overflow-hidden border-teal-100 bg-white transition hover:-translate-y-0.5 hover:shadow-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar employee={employee} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-slate-950">{employee.name}</div>
              <div className="truncate text-sm text-slate-500">{employee.email}</div>
            </div>
          </div>
          <StatusBadge status={employee.status} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="Khoa/phòng" value={employee.department} />
          <Info label="Chức danh" value={employee.position} />
          <Info label="Số CCHN" value={employee.licenseNumber || "Chưa cập nhật"} />
          <Info label="Số tiết" value={`${employee.hours}/${employee.requiredHours}`} />
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button asChild variant="ghost" size="sm"><Link href={`/employees/${employee.id}`}>Chi tiết</Link></Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>Sửa</Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Xóa"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteEmployeeDialog({ target, employees, onCancel, onConfirm }: { target: DeleteTarget; employees: DemoEmployee[]; onCancel: () => void; onConfirm: () => void }) {
  const selectedEmployees = target.type === "single" ? [target.employee] : employees.filter((employee) => target.ids.includes(employee.id));
  const activeCount = selectedEmployees.filter((employee) => employee.status === "Hoạt động").length;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-950">{target.type === "single" ? "Xóa nhân sự này?" : `Xóa ${selectedEmployees.length} nhân sự đã chọn?`}</h2><p className="mt-1 text-sm leading-6 text-slate-600">Thao tác này sẽ xóa hồ sơ nhân sự khỏi hệ thống. Nên tạm khóa tài khoản nếu cần giữ lịch sử vận hành.</p></div>
          </div>
        </div>
        <div className="space-y-3 p-5">
          {activeCount ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">Có {activeCount} nhân sự đang hoạt động. Nên tạm khóa nếu cần giữ lịch sử.</div> : null}
          <div className="max-h-48 overflow-y-auto rounded-2xl border bg-slate-50">
            {selectedEmployees.map((employee) => <div key={employee.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"><div className="flex min-w-0 items-center gap-3"><Avatar employee={employee} /><div><div className="font-semibold">{employee.name}</div><div className="text-xs text-slate-500">{employee.email}</div></div></div><StatusBadge status={employee.status} /></div>)}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}><Trash2 className="h-4 w-4" />Xóa {selectedEmployees.length > 1 ? `${selectedEmployees.length} nhân sự` : "nhân sự"}</Button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ employee, size = "md" }: { employee: DemoEmployee; size?: "md" | "lg" }) {
  const className = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return employee.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Avatar can be a generated object/data URL before upload storage is configured.
    <img src={employee.avatarUrl} alt={employee.name} className={`${className} rounded-2xl border object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center rounded-2xl bg-teal-100 text-teal-700`}><UserRound className={size === "lg" ? "h-8 w-8" : "h-5 w-5"} /></div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 font-semibold text-slate-900">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function requiredHoursForPosition(position: string) {
  if (["Kỹ thuật viên", "Y sĩ"].includes(position)) return 36;
  return 48;
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">{options.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}</select>;
}

function ViewButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className={`flex h-9 w-10 items-center justify-center rounded-lg transition ${active ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-teal-50"}`}>{children}</button>;
}

function PaginationControls({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-xl border bg-white px-2 text-sm">
        {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/trang</option>)}
      </select>
      <span className="text-sm font-semibold text-slate-600">{page}/{totalPages}</span>
      <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Trang trước">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Trang sau">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
