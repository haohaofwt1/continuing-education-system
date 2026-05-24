"use client";

import React, { useMemo, useState } from "react";
import { BarChart3, BellRing, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Columns3, Download, Grid2X2, List, Mail, Save, Search, Settings2, UserRound, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoEmployee, downloadCsv } from "@/lib/demo-store";
import { saveEmployeeToApi } from "@/lib/api-client";
import { annualTargetHours, buildIndividualComplianceCycle, buildTrainingPlanItems, expectedHoursByNow, inferCycleRule, nextCycle, vietnamCmeRules, type TrainingCycleRule } from "@/lib/training-rules";

type ViewMode = "list" | "grid" | "kanban";
type TrainingStatus = "Đạt" | "Chưa đạt" | "Thiếu CCHN";
type TrainingSettings = {
  requiredHours: number;
  cycleStartYear: number;
  cycleEndYear: number;
  cycleRule?: TrainingCycleRule;
  annualMinimumHours?: number | null;
};

const statusOptions: TrainingStatus[] = ["Đạt", "Chưa đạt", "Thiếu CCHN"];
const currentYear = new Date().getFullYear();
const defaultSettings: TrainingSettings = {
  requiredHours: 120,
  cycleStartYear: currentYear,
  cycleEndYear: currentYear + 4,
  cycleRule: "GENERAL_HEALTH_WORKER_5Y",
  annualMinimumHours: 12
};

export function TrainingClient() {
  const [items, setItems] = useState<DemoEmployee[]>([]);
  const [settings, setSettings] = useState<TrainingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [hasActiveCycle, setHasActiveCycle] = useState(false);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showCycleSettings, setShowCycleSettings] = useState(false);
  const [notice, setNotice] = useState("");

  React.useEffect(() => {
    let mounted = true;

    async function loadTrainingData() {
      setLoading(true);
      try {
        const [employeesResponse, cycleResponse] = await Promise.all([
          fetch("/api/employees", { cache: "no-store" }),
          fetch("/api/training/cycles", { cache: "no-store" })
        ]);

        const employeesPayload = employeesResponse.ok ? await employeesResponse.json() as { data: DemoEmployee[] } : { data: [] };
        const cyclePayload = cycleResponse.ok ? await cycleResponse.json() as { data: { startYear: number; endYear: number; requiredHours?: number } | null } : { data: null };
        if (!mounted) return;

        setItems(Array.isArray(employeesPayload.data) ? employeesPayload.data : []);
        setHasActiveCycle(Boolean(cyclePayload.data));
        if (cyclePayload.data) {
          const nextSettings = {
            cycleStartYear: cyclePayload.data.startYear,
            cycleEndYear: cyclePayload.data.endYear,
            requiredHours: cyclePayload.data.requiredHours ?? defaultSettings.requiredHours
          };
          const rule = inferCycleRule({
            startYear: nextSettings.cycleStartYear,
            endYear: nextSettings.cycleEndYear,
            requiredHours: nextSettings.requiredHours
          });
          const ruleConfig = vietnamCmeRules.find((item) => item.key === rule);
          setSettings({
            ...nextSettings,
            cycleRule: rule,
            annualMinimumHours: ruleConfig?.annualMinimumHours ?? 0
          });
        }
      } catch {
        if (!mounted) return;
        setItems([]);
        setHasActiveCycle(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTrainingData();
    return () => {
      mounted = false;
    };
  }, []);

  const activeRuleKey = (settings.cycleRule ?? inferCycleRule({
    startYear: settings.cycleStartYear,
    endYear: settings.cycleEndYear,
    requiredHours: settings.requiredHours
  })) as TrainingCycleRule;
  const activeRule = vietnamCmeRules.find((rule) => rule.key === activeRuleKey) ?? vietnamCmeRules[1];
  const annualMinimumHours = Number(settings.annualMinimumHours ?? activeRule.annualMinimumHours ?? 0);
  const records = useMemo(() => items.map((item) => toTrainingRecord(item, {
    cycleYears: activeRule.durationYears,
    requiredHours: settings.requiredHours,
    annualMinimumHours
  })), [annualMinimumHours, activeRule.durationYears, items, settings.requiredHours]);
  const cycleLabel = hasActiveCycle ? `${settings.cycleStartYear}-${settings.cycleEndYear}` : "Chưa cấu hình";
  const departmentOptions = useMemo(() => Array.from(new Set(records.map((record) => record.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [records]);
  const positionOptions = useMemo(() => Array.from(new Set(records.map((record) => record.position).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [records]);
  const planItems = useMemo(() => buildTrainingPlanItems(records, { endYear: settings.cycleEndYear }), [records, settings.cycleEndYear]);
  const cycleConfig = {
    startYear: settings.cycleStartYear,
    endYear: settings.cycleEndYear,
    requiredHours: settings.requiredHours
  };
  const expectedHours = expectedHoursByNow(cycleConfig, new Date(), annualMinimumHours);
  const annualTarget = annualTargetHours(cycleConfig, annualMinimumHours);
  const nextCyclePreview = nextCycle({
    startYear: settings.cycleStartYear,
    endYear: settings.cycleEndYear,
    requiredHours: settings.requiredHours
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = records.filter((record) => {
      const haystack = `${record.name} ${record.email} ${record.phone} ${record.licenseNumber} ${record.department} ${record.position}`.toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!department || record.department === department) &&
        (!position || record.position === position) &&
        (!status || record.trainingStatus === status)
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
  }, [department, position, query, records, status, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);
  const selectedRows = selectedIds.length ? records.filter((record) => selectedIds.includes(record.id)) : filtered;

  const persist = (next: DemoEmployee[], message: string) => {
    setItems(next);
    setNotice(message);
  };

  const markSelectedComplete = async () => {
    if (!selectedIds.length) return;
    const nextEmployees = items.map((employee) => selectedIds.includes(employee.id) ? { ...employee, hours: employee.requiredHours } : employee);
    const selected = items.filter((item) => selectedIds.includes(item.id));
    await Promise.all(selected.map((item) => saveEmployeeToApi({ ...item, hours: item.requiredHours }, true)));
    persist(nextEmployees, `Đã đánh dấu đạt chu kỳ cho ${selectedIds.length} nhân sự.`);
    setSelectedIds([]);
  };

  const remindSelected = () => {
    const count = selectedIds.length || filtered.filter((record) => record.missing > 0).length;
    setNotice(`Đã tạo lịch nhắc bổ sung chứng chỉ cho ${count} nhân sự: in-app ngay hôm nay, email mỗi 30 ngày và nhắc dày hơn trong 60 ngày cuối chu kỳ.`);
  };

  const moveToStatus = async (employeeId: string, nextStatus: TrainingStatus) => {
    const target = items.find((item) => item.id === employeeId);
    if (!target) return;

    let nextHours = target.hours;
    let nextLicense = target.licenseNumber;

    if (nextStatus === "Đạt") {
      nextHours = target.requiredHours;
    } else if (nextStatus === "Thiếu CCHN") {
      nextLicense = "";
      nextHours = Math.min(target.hours, Math.max(target.requiredHours - 1, 0));
    } else {
      nextHours = Math.min(target.hours, Math.max(target.requiredHours - 1, 0));
    }

    const nextEmployee = { ...target, hours: nextHours, licenseNumber: nextLicense };
    
    await saveEmployeeToApi(nextEmployee, true);

    persist(items.map((employee) => employee.id === employeeId ? nextEmployee : employee), `Đã chuyển nhân sự sang "${nextStatus}" trong bảng tuân thủ.`);
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
        title={hasActiveCycle ? `Đào tạo liên tục ${cycleLabel}` : "Đào tạo liên tục"}
        description={hasActiveCycle ? "Theo dõi tiến độ tích lũy tín chỉ, phát hiện hồ sơ thiếu giờ và lập kế hoạch nhắc bổ sung." : "Chưa có chu kỳ đang áp dụng. Hãy cấu hình chu kỳ để bắt đầu tính tuân thủ."}
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv(selectedIds.length ? "dao-tao-da-chon.csv" : "dao-tao-dang-hien-thi.csv", selectedRows)} disabled={!selectedRows.length}><Download className="h-4 w-4" />{selectedIds.length ? `Xuất ${selectedIds.length} đã chọn` : "Xuất dữ liệu"}</Button>
            <Button onClick={() => setShowCycleSettings(true)}><Settings2 className="h-4 w-4" />Cấu hình chu kỳ</Button>
          </>
        }
      />

      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {loading ? <div className="mb-4 rounded-2xl border bg-white p-4 text-sm font-semibold text-slate-600">Đang tải dữ liệu đào tạo...</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-teal-700" />} value={cycleLabel} label={hasActiveCycle ? `${activeRule.durationYears} năm · ${activeRule.label}` : "Cần thiết lập trước khi tính tuân thủ"} />
        <MetricCard icon={<CheckCircle2 className="h-6 w-6 text-emerald-700" />} value={hasActiveCycle ? `${settings.requiredHours} tiết` : "--"} label={hasActiveCycle ? `Mục tiêu chu kỳ · ${annualTarget} tiết/năm` : "Chưa có mục tiêu áp dụng"} />
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-amber-700" />} value={`${records.filter((record) => record.hours < expectedHours).length} hồ sơ`} label={hasActiveCycle ? `Chưa đạt mốc lũy kế ${expectedHours} tiết` : "Cần cấu hình chu kỳ trước"} />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase text-teal-700">Kế hoạch đào tạo</div>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Kế hoạch bổ sung số tiết</h2>
          </div>
          <Button variant="secondary" onClick={remindSelected}><BellRing className="h-4 w-4" />Tạo lịch nhắc</Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3">
            {planItems.slice(0, 5).map((item) => (
              <Card key={item.id}>
                <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_150px_150px] md:items-center">
                  <div>
                    <div className="font-semibold text-slate-950">{item.employeeName}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.department} · {item.position} · hiện có {item.currentHours}/{item.requiredHours} tiết</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Cần học thêm</div>
                    <div className="mt-1 font-bold text-amber-700">{item.missingHours} tiết</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Hạn hoàn thành</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.dueDate}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!planItems.length ? (
              <div className="rounded-2xl border bg-white p-6 text-sm leading-6 text-slate-600">
                <div className="font-semibold text-slate-950">{records.length ? "Không có hồ sơ cần bổ sung giờ" : "Chưa có dữ liệu nhân sự"}</div>
                <div className="mt-1">{records.length ? "Các hồ sơ hiện tại chưa phát sinh kế hoạch bổ sung trong chu kỳ này." : "Khi bạn thêm nhân sự và chứng chỉ thật, hệ thống sẽ tự tính số tiết còn thiếu và tạo danh sách cần nhắc."}</div>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="font-semibold text-slate-950">Quy tắc sau mỗi chu kỳ</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <p>Chu kỳ đang áp dụng cần theo dõi cả tổng số tiết bắt buộc và mốc tối thiểu từng năm. Hệ thống đang dùng mốc lũy kế {expectedHours} tiết tính đến năm hiện tại.</p>
              <p>Khi kết thúc chu kỳ {cycleLabel}, khóa số liệu vào báo cáo lịch sử, tạo chu kỳ {nextCyclePreview.startYear}-{nextCyclePreview.endYear}, và bắt đầu tính số tiết mới từ 0.</p>
              <p>Chứng chỉ cũ vẫn nằm trong hồ sơ minh chứng nhưng không cộng sang chu kỳ mới, trừ khi ngày học/cấp thuộc đúng chu kỳ được gán.</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm nhân sự, khoa/phòng, CCHN..." />
            </div>
            <Select value={department} onChange={(value) => { setDepartment(value); setPage(1); }} options={["", ...departmentOptions]} labels={{ "": "Tất cả khoa/phòng" }} />
            <Select value={position} onChange={(value) => { setPosition(value); setPage(1); }} options={["", ...positionOptions]} labels={{ "": "Tất cả chức danh" }} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...statusOptions]} labels={{ "": "Tất cả trạng thái" }} />
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
      const pageIds = paged.map((record) => record.id);
      const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
      setSelectedIds(allPageSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
    }}
    onMove={moveToStatus}
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
          onSave={async (nextSettings, applyDefaultHours) => {
            await fetch("/api/training/cycles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `Chu kỳ ${nextSettings.cycleStartYear}-${nextSettings.cycleEndYear}`,
                startYear: nextSettings.cycleStartYear,
                endYear: nextSettings.cycleEndYear,
                requiredHours: nextSettings.requiredHours,
                isActive: true
              })
            });
            if (applyDefaultHours) {
              const nextEmployees = items.map((employee) => ({ ...employee, requiredHours: nextSettings.requiredHours }));
              await Promise.all(nextEmployees.map((employee) => saveEmployeeToApi(employee, true)));
              setItems(nextEmployees);
            }
            setSettings(nextSettings);
            setHasActiveCycle(true);
            setShowCycleSettings(false);
            setNotice(applyDefaultHours ? "Đã lưu cấu hình chu kỳ và áp dụng số tiết mặc định cho nhân sự." : "Đã lưu cấu hình chu kỳ.");
          }}
        />
      ) : null}
    </>
  );
}

type TrainingRecord = DemoEmployee & {
  missing: number;
  trainingStatus: TrainingStatus;
  cycleStartDate: string;
  cycleEndDate: string;
  cycleLabel: string;
  annualMinimumHours: number;
};

function toTrainingRecord(employee: DemoEmployee, policy: { cycleYears: number; requiredHours: number; annualMinimumHours: number }): TrainingRecord {
  const requiredHours = Math.max(employee.requiredHours || 0, policy.requiredHours || 0);
  const cycle = buildIndividualComplianceCycle(
    employee.complianceCycleStartDate || employee.licenseIssuedAt || null,
    {
      cycleYears: policy.cycleYears,
      requiredHours,
      annualMinimumHours: policy.annualMinimumHours
    }
  );
  const missing = Math.max(requiredHours - employee.hours, 0);
  const trainingStatus: TrainingStatus = !employee.licenseNumber ? "Thiếu CCHN" : missing === 0 ? "Đạt" : "Chưa đạt";
  return {
    ...employee,
    requiredHours,
    annualMinimumHours: cycle.annualMinimumHours,
    missing,
    trainingStatus,
    cycleStartDate: cycle.startDate,
    cycleEndDate: cycle.endDate,
    cycleLabel: cycle.label
  };
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
  const [ruleKey, setRuleKey] = useState<TrainingCycleRule>((settings.cycleRule ?? inferCycleRule({
    startYear: settings.cycleStartYear,
    endYear: settings.cycleEndYear,
    requiredHours: settings.requiredHours
  })) as TrainingCycleRule);
  const selectedRule = vietnamCmeRules.find((rule) => rule.key === ruleKey) ?? vietnamCmeRules[1];

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cycleStartYear = Number(formData.get("cycleStartYear") || settings.cycleStartYear);
    const cycleEndYear = Number(formData.get("cycleEndYear") || cycleStartYear + selectedRule.durationYears - 1);
    const requiredHours = Number(formData.get("requiredHours") || settings.requiredHours);
    const annualMinimumHours = Number(formData.get("annualMinimumHours") || selectedRule.annualMinimumHours || 0);

    onSave({
      ...settings,
      cycleRule: ruleKey,
      cycleStartYear,
      cycleEndYear: Math.max(cycleEndYear, cycleStartYear),
      requiredHours: Math.max(requiredHours, 0),
      annualMinimumHours: Math.max(annualMinimumHours, 0)
    }, applyDefaultHours);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <div className="text-sm font-semibold uppercase text-teal-700">Cấu hình chu kỳ</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Quy định đào tạo liên tục</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Thiết lập giai đoạn tính tuân thủ, tổng số tiết bắt buộc và mốc tối thiểu theo năm.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></Button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <Field label="Loại chu kỳ">
              <select
                name="cycleRule"
                value={ruleKey}
                onChange={(event) => {
                  const nextKey = event.target.value as TrainingCycleRule;
                  const nextRule = vietnamCmeRules.find((rule) => rule.key === nextKey) ?? vietnamCmeRules[1];
                  setRuleKey(nextKey);
                  const startInput = document.querySelector<HTMLInputElement>('input[name="cycleStartYear"]');
                  const endInput = document.querySelector<HTMLInputElement>('input[name="cycleEndYear"]');
                  const hoursInput = document.querySelector<HTMLInputElement>('input[name="requiredHours"]');
                  const annualInput = document.querySelector<HTMLInputElement>('input[name="annualMinimumHours"]');
                  const startYear = Number(startInput?.value || settings.cycleStartYear);
                  if (endInput) endInput.value = String(startYear + nextRule.durationYears - 1);
                  if (hoursInput) hoursInput.value = String(nextRule.requiredHours);
                  if (annualInput) annualInput.value = String(nextRule.annualMinimumHours ?? 0);
                }}
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
              >
                {vietnamCmeRules.map((rule) => <option key={rule.key} value={rule.key}>{rule.label} · {rule.requiredHours} tiết / {rule.durationYears} năm</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Năm bắt đầu chu kỳ">
                <Input
                  name="cycleStartYear"
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={settings.cycleStartYear}
                  onChange={(event) => {
                    const endInput = document.querySelector<HTMLInputElement>('input[name="cycleEndYear"]');
                    if (endInput) endInput.value = String(Number(event.target.value || settings.cycleStartYear) + selectedRule.durationYears - 1);
                  }}
                />
              </Field>
              <Field label="Năm kết thúc chu kỳ">
                <Input name="cycleEndYear" type="number" min={2000} max={2100} defaultValue={Math.max(settings.cycleEndYear, settings.cycleStartYear + selectedRule.durationYears - 1)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tổng số tiết yêu cầu">
                <Input name="requiredHours" type="number" min={0} defaultValue={Math.max(settings.requiredHours, selectedRule.requiredHours)} />
                <p className="mt-2 text-xs leading-5 text-slate-500">Dùng để tính thiếu/đạt trong toàn chu kỳ.</p>
              </Field>
              <Field label="Tối thiểu mỗi năm">
                <Input name="annualMinimumHours" type="number" min={0} defaultValue={settings.annualMinimumHours ?? selectedRule.annualMinimumHours ?? 0} />
                <p className="mt-2 text-xs leading-5 text-slate-500">Dùng cho cảnh báo tiến độ theo từng năm.</p>
              </Field>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-sm font-semibold text-slate-950">Quy định tham chiếu</div>
              <div className="mt-3 grid gap-3">
                {vietnamCmeRules.map((rule) => (
                  <div key={rule.key} className="rounded-xl bg-slate-50 p-3 text-sm leading-6">
                    <div className="font-semibold text-slate-900">{rule.label}: {rule.requiredHours} tiết / {rule.durationYears} năm</div>
                    <div className="text-slate-600">{rule.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border bg-teal-50/60 p-4 text-sm">
              <input type="checkbox" checked={applyDefaultHours} onChange={(event) => setApplyDefaultHours(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-600" />
              <span>
                <span className="block font-semibold text-slate-900">Áp dụng số tiết mặc định cho toàn bộ nhân sự hiện có</span>
                <span className="mt-1 block leading-6 text-slate-600">Bật khi đơn vị muốn chuẩn hóa lại yêu cầu theo chu kỳ đang cấu hình. Các ngoại lệ theo chức danh có thể cập nhật ở hồ sơ nhân sự.</span>
              </span>
            </label>
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

function TrainingList({ 
  records, 
  selectedIds, 
  sortConfig,
  onSort,
  onToggle, 
  onToggleAll,
  onMove
}: { 
  records: TrainingRecord[]; 
  selectedIds: string[]; 
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  onToggle: (id: string) => void; 
  onToggleAll: () => void;
  onMove: (id: string, status: TrainingStatus) => void;
}) {
  const allChecked = records.length > 0 && records.every((record) => selectedIds.includes(record.id));
  
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
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-teal-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4"><input type="checkbox" checked={allChecked} onChange={onToggleAll} className="h-4 w-4 rounded accent-teal-600" aria-label="Chọn tất cả" /></th>
              <SortHeader label="Nhân sự" sortKey="name" />
              <SortHeader label="Khoa/phòng" sortKey="department" />
              <SortHeader label="Chức danh" sortKey="position" />
              <SortHeader label="Chu kỳ cá nhân" sortKey="cycleStartDate" />
              <SortHeader label="Đã có" sortKey="hours" />
              <SortHeader label="Yêu cầu" sortKey="requiredHours" />
              <SortHeader label="Còn thiếu" sortKey="missing" />
              <SortHeader label="Trạng thái" sortKey="trainingStatus" />
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-teal-50/40">
                <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => onToggle(record.id)} className="h-4 w-4 rounded accent-teal-600" aria-label={`Chọn ${record.name}`} /></td>
                <td className="py-4 px-4"><div className="flex items-center gap-3"><Avatar record={record} /><div><div className="font-semibold text-slate-950">{record.name}</div><div className="text-xs text-slate-500">{record.email} · {record.licenseNumber || "Chưa có CCHN"}</div></div></div></td>
                <td className="px-4">{record.department}</td>
                <td className="px-4">{record.position}</td>
                <td className="px-4"><div className="font-semibold">{record.cycleStartDate}</div><div className="text-xs text-slate-500">đến {record.cycleEndDate}</div></td>
                <td className="px-4 font-semibold">{record.hours}</td>
                <td className="px-4">{record.requiredHours}</td>
                <td className={`px-4 ${record.missing ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}`}>{record.missing}</td>
                <td className="px-4"><StatusBadge status={record.trainingStatus} /></td>
                <td className="pr-5">
                  <select value={record.trainingStatus} onChange={(event) => onMove(record.id, event.target.value as TrainingStatus)} className="h-8 rounded-lg border bg-white px-2 text-xs">
                    {statusOptions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </td>
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
          <Info label="Chu kỳ" value={`${record.cycleStartDate} - ${record.cycleEndDate}`} />
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
