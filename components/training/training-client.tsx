"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Columns3, Download, Grid2X2, List, Mail, Save, Search, Settings2, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departments, positions } from "@/lib/mock-data";
import { DemoEmployee, downloadCsv, getEmployees, getSettings, saveEmployees, saveSettings } from "@/lib/demo-store";

type ViewMode = "list" | "grid" | "kanban";
type TrainingStatus = "Đạt" | "Chưa đạt" | "Thiếu CCHN";

const statusOptions: TrainingStatus[] = ["Đạt", "Chưa đạt", "Thiếu CCHN"];

export function TrainingClient() {
  const [items, setItems] = useState<DemoEmployee[]>(() => getEmployees());
  const [settings, setSettings] = useState(() => getSettings());
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCycleSettings, setShowCycleSettings] = useState(false);
  const [notice, setNotice] = useState("");

  const records = useMemo(() => items.map(toTrainingRecord), [items]);
  const cycleLabel = `${settings.cycleStartYear}-${settings.cycleEndYear}`;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = `${record.name} ${record.email} ${record.phone} ${record.licenseNumber} ${record.department} ${record.position}`.toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!department || record.department === department) &&
        (!position || record.position === position) &&
        (!status || record.trainingStatus === status)
      );
    });
  }, [department, position, query, records, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);
  const selectedRows = selectedIds.length ? records.filter((record) => selectedIds.includes(record.id)) : filtered;

  const persist = (next: DemoEmployee[], message: string) => {
    setItems(next);
    saveEmployees(next);
    setNotice(message);
  };

  const markSelectedComplete = () => {
    if (!selectedIds.length) return;
    persist(items.map((employee) => selectedIds.includes(employee.id) ? { ...employee, hours: employee.requiredHours } : employee), `Đã đánh dấu đạt chu kỳ cho ${selectedIds.length} nhân sự.`);
    setSelectedIds([]);
  };

  const remindSelected = () => {
    const count = selectedIds.length || filtered.filter((record) => record.missing > 0).length;
    setNotice(`Đã tạo nhắc bổ sung chứng chỉ cho ${count} nhân sự trong demo mode.`);
  };

  const moveToStatus = (employeeId: string, nextStatus: TrainingStatus) => {
    persist(items.map((employee) => {
      if (employee.id !== employeeId) return employee;
      if (nextStatus === "Đạt") return { ...employee, hours: employee.requiredHours };
      if (nextStatus === "Thiếu CCHN") return { ...employee, licenseNumber: "", hours: Math.min(employee.hours, Math.max(employee.requiredHours - 1, 0)) };
      return { ...employee, hours: Math.min(employee.hours, Math.max(employee.requiredHours - 1, 0)) };
    }), `Đã chuyển nhân sự sang "${nextStatus}" trong bảng tuân thủ.`);
  };

  const resetFilters = () => {
    setQuery("");
    setDepartment("");
    setPosition("");
    setStatus("");
    setPage(1);
  };

  return (
    <>
      <PageHeader
        eyebrow="Chu kỳ tuân thủ"
        title={`Đào tạo liên tục ${cycleLabel}`}
        description="Đồng bộ list/grid/kanban, tick chọn, phân trang và bulk action như các module còn lại."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv(selectedIds.length ? "dao-tao-da-chon.csv" : "dao-tao-dang-hien-thi.csv", selectedRows)}><Download className="h-4 w-4" />{selectedIds.length ? `Export ${selectedIds.length} đã chọn` : "Export"}</Button>
            <Button onClick={() => setShowCycleSettings(true)}><Settings2 className="h-4 w-4" />Cấu hình chu kỳ</Button>
          </>
        }
      />

      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-teal-700" />} value={cycleLabel} label="Chu kỳ đang áp dụng" />
        <MetricCard icon={<CheckCircle2 className="h-6 w-6 text-emerald-700" />} value={`${settings.requiredHours} tiết`} label="Yêu cầu mặc định" />
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-amber-700" />} value={`${records.filter((record) => record.missing > 0).length} hồ sơ`} label="Cần bổ sung số tiết" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm nhân sự, khoa/phòng, CCHN..." />
            </div>
            <Select value={department} onChange={(value) => { setDepartment(value); setPage(1); }} options={["", ...departments]} labels={{ "": "Tất cả khoa/phòng" }} />
            <Select value={position} onChange={(value) => { setPosition(value); setPage(1); }} options={["", ...positions]} labels={{ "": "Tất cả chức danh" }} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...statusOptions]} labels={{ "": "Tất cả trạng thái" }} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Xóa lọc</Button>
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
          <Button size="sm" variant="secondary" onClick={markSelectedComplete}>Đánh dấu đạt</Button>
          <Button size="sm" variant="secondary" onClick={remindSelected}><Mail className="h-4 w-4" />Gửi nhắc</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Hiển thị {filtered.length ? pageStart + 1 : 0}-{pageEnd} / {filtered.length} hồ sơ</span>
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
        <TrainingList
          records={paged}
          selectedIds={selectedIds}
          onToggle={(id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onToggleAll={() => {
            const pageIds = paged.map((record) => record.id);
            const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
            setSelectedIds(allPageSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
          }}
        />
      ) : null}

      {viewMode === "grid" ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {paged.map((record) => (
            <TrainingCard
              key={record.id}
              record={record}
              checked={selectedIds.includes(record.id)}
              onToggle={() => setSelectedIds((ids) => ids.includes(record.id) ? ids.filter((id) => id !== record.id) : [...ids, record.id])}
            />
          ))}
        </div>
      ) : null}

      {viewMode === "kanban" ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {statusOptions.map((column) => (
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
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{filtered.filter((record) => record.trainingStatus === column).length}</span>
              </div>
              <div className="space-y-3">
                {paged.filter((record) => record.trainingStatus === column).map((record) => (
                  <div key={record.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", record.id)} className="cursor-grab rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 active:cursor-grabbing">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar record={record} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-950">{record.name}</div>
                          <div className="truncate text-sm text-slate-500">{record.position}</div>
                        </div>
                      </div>
                      <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => setSelectedIds((ids) => ids.includes(record.id) ? ids.filter((id) => id !== record.id) : [...ids, record.id])} className="h-4 w-4 accent-teal-600" aria-label={`Chọn ${record.name}`} />
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{record.department}</div>
                    <ProgressBar record={record} />
                    <div className="mt-2 text-sm font-semibold">{record.hours}/{record.requiredHours} tiết</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

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

      {showCycleSettings ? (
        <CycleSettingsDrawer
          settings={settings}
          onClose={() => setShowCycleSettings(false)}
          onSave={(nextSettings, applyDefaultHours) => {
            setSettings(nextSettings);
            saveSettings(nextSettings);
            if (applyDefaultHours) {
              const nextEmployees = items.map((employee) => ({ ...employee, requiredHours: nextSettings.requiredHours }));
              setItems(nextEmployees);
              saveEmployees(nextEmployees);
            }
            setShowCycleSettings(false);
            setNotice(applyDefaultHours ? "Đã lưu cấu hình chu kỳ và áp dụng số tiết mặc định cho nhân sự." : "Đã lưu cấu hình chu kỳ.");
          }}
        />
      ) : null}
    </>
  );
}

type TrainingSettings = ReturnType<typeof getSettings>;

type TrainingRecord = DemoEmployee & {
  missing: number;
  trainingStatus: TrainingStatus;
};

function toTrainingRecord(employee: DemoEmployee): TrainingRecord {
  const missing = Math.max(employee.requiredHours - employee.hours, 0);
  const trainingStatus: TrainingStatus = !employee.licenseNumber ? "Thiếu CCHN" : missing === 0 ? "Đạt" : "Chưa đạt";
  return { ...employee, missing, trainingStatus };
}

function MetricCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        {icon}
        <div className="mt-3 text-2xl font-bold">{value}</div>
        <p className="text-sm text-slate-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function CycleSettingsDrawer({
  settings,
  onClose,
  onSave
}: {
  settings: TrainingSettings;
  onClose: () => void;
  onSave: (settings: TrainingSettings, applyDefaultHours: boolean) => void;
}) {
  const [applyDefaultHours, setApplyDefaultHours] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cycleStartYear = Number(formData.get("cycleStartYear") || settings.cycleStartYear);
    const cycleEndYear = Number(formData.get("cycleEndYear") || settings.cycleEndYear);
    const requiredHours = Number(formData.get("requiredHours") || settings.requiredHours);

    onSave({
      ...settings,
      cycleStartYear,
      cycleEndYear: Math.max(cycleEndYear, cycleStartYear),
      requiredHours: Math.max(requiredHours, 0)
    }, applyDefaultHours);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <div className="text-sm font-semibold uppercase text-teal-700">Cấu hình chu kỳ</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Quy định đào tạo liên tục</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Thiết lập giai đoạn tính tuân thủ và số tiết yêu cầu mặc định. Các số tiết đã có vẫn lấy từ chứng chỉ đã duyệt hoặc dữ liệu demo hiện tại.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></Button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Năm bắt đầu chu kỳ">
                <Input name="cycleStartYear" type="number" min={2000} max={2100} defaultValue={settings.cycleStartYear} />
              </Field>
              <Field label="Năm kết thúc chu kỳ">
                <Input name="cycleEndYear" type="number" min={2000} max={2100} defaultValue={settings.cycleEndYear} />
              </Field>
            </div>
            <Field label="Số tiết yêu cầu mặc định">
              <Input name="requiredHours" type="number" min={0} defaultValue={settings.requiredHours} />
              <p className="mt-2 text-xs leading-5 text-slate-500">Dùng làm chuẩn mặc định khi tạo nhân sự mới hoặc khi admin chọn áp dụng lại cho danh sách hiện có.</p>
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border bg-teal-50/60 p-4 text-sm">
              <input type="checkbox" checked={applyDefaultHours} onChange={(event) => setApplyDefaultHours(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-600" />
              <span>
                <span className="block font-semibold text-slate-900">Áp dụng số tiết mặc định cho toàn bộ nhân sự hiện có</span>
                <span className="mt-1 block leading-6 text-slate-600">Chỉ nên bật khi đơn vị muốn chuẩn hóa lại yêu cầu trong demo. Thực tế nên cấu hình theo chức danh/khoa phòng ở module quản trị.</span>
              </span>
            </label>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Trong bản MVP này cấu hình được lưu ở localStorage. Khi nối database thật, phần này sẽ ghi vào bảng `Setting` và `TrainingCycle`.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button type="submit"><Save className="h-4 w-4" />Lưu cấu hình</Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function TrainingList({ records, selectedIds, onToggle, onToggleAll }: { records: TrainingRecord[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void }) {
  const allChecked = records.length > 0 && records.every((record) => selectedIds.includes(record.id));
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-teal-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4"><input type="checkbox" checked={allChecked} onChange={onToggleAll} className="h-4 w-4 rounded accent-teal-600" aria-label="Chọn tất cả" /></th>
              <th>Nhân sự</th><th>Khoa/phòng</th><th>Chức danh</th><th>Đã có</th><th>Yêu cầu</th><th>Còn thiếu</th><th>Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-teal-50/40">
                <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => onToggle(record.id)} className="h-4 w-4 rounded accent-teal-600" aria-label={`Chọn ${record.name}`} /></td>
                <td className="py-4"><div className="flex items-center gap-3"><Avatar record={record} /><div><div className="font-semibold text-slate-950">{record.name}</div><div className="text-xs text-slate-500">{record.email} · {record.licenseNumber || "Chưa có CCHN"}</div></div></div></td>
                <td>{record.department}</td>
                <td>{record.position}</td>
                <td className="font-semibold">{record.hours}</td>
                <td>{record.requiredHours}</td>
                <td className={record.missing ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{record.missing}</td>
                <td><StatusBadge status={record.trainingStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrainingCard({ record, checked, onToggle }: { record: TrainingRecord; checked: boolean; onToggle: () => void }) {
  return (
    <Card className="overflow-hidden border-teal-100 bg-white transition hover:-translate-y-0.5 hover:shadow-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar record={record} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-slate-950">{record.name}</div>
              <div className="truncate text-sm text-slate-500">{record.department}</div>
            </div>
          </div>
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-teal-600" aria-label={`Chọn ${record.name}`} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <StatusBadge status={record.trainingStatus} />
          <div className="text-sm font-semibold">{record.hours}/{record.requiredHours} tiết</div>
        </div>
        <ProgressBar record={record} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Chức danh" value={record.position} />
          <Info label="Còn thiếu" value={`${record.missing} tiết`} />
          <Info label="CCHN" value={record.licenseNumber || "Chưa cập nhật"} />
          <Info label="Email" value={record.email} />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ record }: { record: TrainingRecord }) {
  const percent = record.requiredHours ? Math.min((record.hours / record.requiredHours) * 100, 100) : 0;
  return (
    <div className="mt-3 h-2.5 rounded-full bg-slate-100">
      <div className="h-2.5 rounded-full bg-teal-600" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Avatar({ record, size = "md" }: { record: TrainingRecord; size?: "md" | "lg" }) {
  const className = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return record.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Avatar can be a local data URL in demo mode.
    <img src={record.avatarUrl} alt={record.name} className={`${className} rounded-2xl border object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center rounded-2xl bg-teal-100 text-teal-700`}><UserRound className={size === "lg" ? "h-8 w-8" : "h-5 w-5"} /></div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 truncate font-semibold text-slate-900">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
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
