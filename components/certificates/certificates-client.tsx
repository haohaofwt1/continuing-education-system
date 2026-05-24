"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, Check, ChevronLeft, ChevronRight, Columns3, Download, Edit3, Eye, FileSpreadsheet, Filter, Grid2X2, ImageUp, List, Plus, RotateCcw, RotateCw, Save, Search, SlidersHorizontal, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { CertificateCard } from "@/components/certificates/certificate-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CertificateUploadWizard } from "@/components/upload/certificate-upload-wizard";
import { DemoCertificate, downloadCsv } from "@/lib/demo-store";
import { deleteCertificateFromApi, saveCertificateToApi } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

const quickFilters = ["Chờ duyệt", "Đã duyệt", "Thiếu thông tin", "Sắp hết hạn", "Đã hết hạn", "Nghi trùng", "Không tính chu kỳ", "Không có ảnh"];
const kanbanColumns = ["Chờ duyệt", "Đã duyệt", "Thiếu thông tin", "Sắp hết hạn", "Đã hết hạn", "Không tính chu kỳ"];
type ViewMode = "grid" | "list" | "kanban";
type DrawerMode = "view" | "edit";
type DateField = "issuedDate" | "studyStartDate" | "expiredDate";
type Period = "all" | "today" | "month" | "quarter" | "year" | "custom";
type DeleteTarget =
  | { type: "single"; certificate: DemoCertificate }
  | { type: "bulk"; ids: string[] };

export function CertificatesClient() {
  const [items, setItems] = useState<DemoCertificate[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [aiFilter, setAiFilter] = useState("");
  const [dateField, setDateField] = useState<DateField>("issuedDate");
  const [period, setPeriod] = useState<Period>("all");
  const [month, setMonth] = useState("2026-01");
  const [quarter, setQuarter] = useState("2026-Q1");
  const [year, setYear] = useState("2026");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<DemoCertificate | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("view");
  const [zoomed, setZoomed] = useState<DemoCertificate | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/certificates")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload: { data: DemoCertificate[] }) => {
        setItems(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch(() => setItems([]));
  }, []);

  const persist = (next: DemoCertificate[], message: string) => {
    setItems(next);
    setNotice(message);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = items.filter((certificate) => {
      const haystack = `${certificate.title} ${certificate.holder} ${certificate.code} ${certificate.issuer} ${certificate.courseContent ?? ""}`.toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!department || certificate.department === department) &&
        (!type || certificate.type === type) &&
        (!status || certificate.status === status) &&
        matchesDate(certificate, dateField, period, { month, quarter, year, dateFrom, dateTo }) &&
        (!aiFilter || applyNaturalFilter(certificate, aiFilter))
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
  }, [aiFilter, dateField, dateFrom, dateTo, department, items, month, period, quarter, query, status, type, year, sortConfig]);

  const types = Array.from(new Set(items.map((item) => item.type).filter(Boolean)));
  const departmentOptions = Array.from(new Set(items.map((item) => item.department).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);

  const openDrawer = (certificate: DemoCertificate, mode: DrawerMode) => {
    setSelected(certificate);
    setDrawerMode(mode);
  };

  const approve = async (certificate: DemoCertificate) => {
    await saveCertificateToApi({ ...certificate, status: "Đã duyệt", tone: "green" }, true);
    persist(items.map((item) => item.id === certificate.id ? { ...item, status: "Đã duyệt", tone: "green" } : item), "Đã duyệt chứng chỉ.");
  };

  const removeNow = async (certificate: DemoCertificate) => {
    await deleteCertificateFromApi(certificate.id);
    persist(items.filter((item) => item.id !== certificate.id), "Đã xóa chứng chỉ.");
    if (selected?.id === certificate.id) setSelected(null);
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    const imageFile = formData.get("thumbnailFile");
    const uploadedFile = imageFile instanceof File && imageFile.size > 0 ? await uploadFileToServer(imageFile) : null;
    const thumbnail = uploadedFile?.thumbnailUrl || uploadedFile?.url || selected.thumbnail;
    const next: DemoCertificate = {
      ...selected,
      code: String(formData.get("certificateNumber") ?? "") || selected.code,
      certificateNumber: String(formData.get("certificateNumber") ?? ""),
      title: String(formData.get("title") ?? ""),
      holder: String(formData.get("holder") ?? ""),
      holderBirthDate: String(formData.get("holderBirthDate") ?? ""),
      holderAddress: String(formData.get("holderAddress") ?? ""),
      type: String(formData.get("type") ?? ""),
      issuer: String(formData.get("issuer") ?? ""),
      issuePlace: String(formData.get("issuePlace") ?? ""),
      issuedDate: String(formData.get("issuedDate") ?? ""),
      expiredDate: String(formData.get("expiredDate") ?? "") || null,
      studyStartDate: String(formData.get("studyStartDate") ?? ""),
      studyEndDate: String(formData.get("studyEndDate") ?? ""),
      hours: Number(formData.get("hours") ?? 0),
      equivalentCredits: Number(formData.get("equivalentCredits") ?? 0),
      responsibleUnit: String(formData.get("responsibleUnit") ?? ""),
      learningFormat: String(formData.get("learningFormat") ?? ""),
      courseContent: String(formData.get("courseContent") ?? ""),
      verificationNumber: String(formData.get("verificationNumber") ?? ""),
      department: String(formData.get("department") ?? selected.department),
      position: String(formData.get("position") ?? selected.position),
      status: String(formData.get("status") ?? selected.status),
      thumbnail,
      fileUrl: uploadedFile?.url ?? selected.fileUrl ?? null,
      fileName: uploadedFile?.fileName ?? selected.fileName ?? null,
      fileMimeType: uploadedFile?.mimeType ?? selected.fileMimeType ?? null,
      fileSizeBytes: uploadedFile?.sizeBytes ?? selected.fileSizeBytes ?? null
    };
    const saved = await saveCertificateToApi(next, true);
    persist(items.map((item) => item.id === selected.id ? saved : item), "Đã cập nhật chứng chỉ.");
    setSelected(null);
  };

  const bulkUpdateStatus = async (nextStatus: string) => {
    if (!selectedIds.length) return;
    const nextTone = nextStatus === "Đã duyệt" ? "green" : nextStatus === "Đã hết hạn" ? "red" : nextStatus === "Thiếu thông tin" ? "gray" : "yellow";
    const selected = items.filter((item) => selectedIds.includes(item.id));
    await Promise.all(selected.map((item) => saveCertificateToApi({ ...item, status: nextStatus, tone: nextTone }, true)));
    persist(items.map((item) => selectedIds.includes(item.id) ? { ...item, status: nextStatus, tone: nextTone } : item), `Đã chuyển ${selectedIds.length} chứng chỉ sang "${nextStatus}".`);
    setSelectedIds([]);
  };

  const bulkDelete = () => {
    if (!selectedIds.length) return;
    setDeleteTarget({ type: "bulk", ids: selectedIds });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "single") {
      await removeNow(deleteTarget.certificate);
      setSelectedIds((ids) => ids.filter((id) => id !== deleteTarget.certificate.id));
    } else {
      await Promise.all(deleteTarget.ids.map(deleteCertificateFromApi));
      persist(items.filter((item) => !deleteTarget.ids.includes(item.id)), `Đã xóa ${deleteTarget.ids.length} chứng chỉ.`);
      setSelectedIds([]);
    }
    setDeleteTarget(null);
  };

  const moveToStatus = async (certificateId: string, nextStatus: string) => {
    const target = items.find((item) => item.id === certificateId);
    const nextTone = nextStatus === "Đã duyệt" ? "green" : nextStatus === "Đã hết hạn" ? "red" : nextStatus === "Thiếu thông tin" ? "gray" : "yellow";
    if (target) await saveCertificateToApi({ ...target, status: nextStatus, tone: nextTone }, true);
    persist(items.map((item) => item.id === certificateId ? { ...item, status: nextStatus, tone: nextTone } : item), `Đã chuyển chứng chỉ sang "${nextStatus}".`);
  };

  const selectedForExport = selectedIds.length ? items.filter((item) => selectedIds.includes(item.id)) : filtered;
  const exportLabel = selectedIds.length ? `Export ${selectedIds.length} đã chọn` : `Export ${filtered.length} đang hiển thị`;
  const hasActiveFilter = Boolean(query || department || type || status || aiFilter || period !== "all");

  const exportRows = (scope: "context" | "visible" | "all") => {
    const rows = scope === "all" ? items : scope === "visible" ? filtered : selectedForExport;
    const suffix = scope === "all" ? "tat-ca" : scope === "visible" ? "dang-hien-thi" : selectedIds.length ? "da-chon" : "dang-hien-thi";
    downloadCsv(`chung-chi-${suffix}.csv`, rows);
    setExportOpen(false);
    setNotice(`Đã export ${rows.length} chứng chỉ${scope === "all" ? " toàn hệ thống" : selectedIds.length && scope === "context" ? " đã chọn" : " đang hiển thị"}.`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Quản lý chứng chỉ"
        title="Upload, OCR và duyệt chứng chỉ"
        description="Quản lý chứng chỉ, OCR, trạng thái duyệt và số tiết được tính vào chu kỳ đào tạo."
        actions={
          <>
            <div className="relative">
              <Button variant="secondary" onClick={() => setExportOpen((value) => !value)}><Download className="h-4 w-4" />{exportLabel}</Button>
              {exportOpen ? (
                <div className="absolute right-0 top-12 z-40 w-80 rounded-2xl border bg-white p-2 text-sm shadow-2xl">
                  <button type="button" onClick={() => exportRows("context")} className="w-full rounded-xl p-3 text-left transition hover:bg-teal-50">
                    <div className="font-semibold text-slate-900">{selectedIds.length ? `Export ${selectedIds.length} chứng chỉ đã chọn` : `Export ${filtered.length} chứng chỉ đang hiển thị`}</div>
                    <div className="mt-1 text-xs text-slate-500">{selectedIds.length ? "Ưu tiên theo các dòng đang tick." : hasActiveFilter ? "Theo search/filter hiện tại." : "Hiện tại tương đương toàn bộ danh sách."}</div>
                  </button>
                  <button type="button" onClick={() => exportRows("visible")} className="w-full rounded-xl p-3 text-left transition hover:bg-teal-50">
                    <div className="font-semibold text-slate-900">Export danh sách đang hiển thị</div>
                    <div className="mt-1 text-xs text-slate-500">{filtered.length} chứng chỉ sau search/filter.</div>
                  </button>
                  <button type="button" onClick={() => exportRows("all")} className="w-full rounded-xl p-3 text-left transition hover:bg-teal-50">
                    <div className="font-semibold text-slate-900">Export tất cả</div>
                    <div className="mt-1 text-xs text-slate-500">{items.length} chứng chỉ, bỏ qua filter và lựa chọn.</div>
                  </button>
                  <div className="mt-1 border-t px-3 py-2 text-xs text-slate-500">
                    File ảnh/PDF ZIP sẽ phù hợp hơn ở bước nối storage thật.
                  </div>
                </div>
              ) : null}
            </div>
            <Button onClick={() => setShowWizard((value) => !value)}><Plus className="h-4 w-4" />Thêm chứng chỉ</Button>
          </>
        }
      />
      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {showWizard ? (
        <CertificateUploadWizard
          onCreate={async (certificate) => {
            const saved = await saveCertificateToApi(certificate, false);
            persist([saved, ...items], "Đã tạo chứng chỉ từ OCR.");
            setShowWizard(false);
          }}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<FileSpreadsheet className="h-6 w-6 text-teal-700" />} value={`${items.length}`} label="Tổng chứng chỉ" />
        <MetricCard icon={<Check className="h-6 w-6 text-emerald-700" />} value={`${items.filter(i => i.status === "Đã duyệt").length}`} label="Đã phê duyệt" />
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-amber-700" />} value={`${items.filter(i => i.status === "Sắp hết hạn").length}`} label="Sắp hết hạn" />
        <MetricCard icon={<Search className="h-6 w-6 text-sky-700" />} value={`${filtered.length}`} label="Chứng chỉ đang lọc" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm chứng chỉ, nhân sự, mã, đơn vị cấp, nội dung..." />
            </div>
            <Select value={department} onChange={(value) => { setDepartment(value); setPage(1); }} options={["", ...departmentOptions]} labels={{ "": "Tất cả khoa/phòng" }} />
            <Select value={type} onChange={(value) => { setType(value); setPage(1); }} options={["", ...types]} labels={{ "": "Tất cả loại" }} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...quickFilters]} labels={{ "": "Tất cả trạng thái" }} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[180px_160px_1fr]">
            <Select value={dateField} onChange={(value) => { setDateField(value as DateField); setPage(1); }} options={["issuedDate", "studyStartDate", "expiredDate"]} labels={{ issuedDate: "Theo ngày cấp", studyStartDate: "Theo ngày học", expiredDate: "Theo hết hạn" }} />
            <Select value={period} onChange={(value) => { setPeriod(value as Period); setPage(1); }} options={["all", "today", "month", "quarter", "year", "custom"]} labels={{ all: "Mọi thời gian", today: "Hôm nay", month: "Theo tháng", quarter: "Theo quý", year: "Theo năm", custom: "Tùy chọn" }} />
            <div className="grid gap-3 md:grid-cols-4">
              {period === "month" ? <Input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} /> : null}
              {period === "quarter" ? (
                <select value={quarter} onChange={(event) => { setQuarter(event.target.value); setPage(1); }} className="h-10 rounded-xl border bg-white px-3 text-sm">
                  {["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"].map((item) => <option key={item}>{item}</option>)}
                </select>
              ) : null}
              {period === "year" ? <Input value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }} placeholder="2026" /> : null}
              {period === "custom" ? <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /> : null}
              {period === "custom" ? <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /> : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button key={filter} variant={status === filter ? "default" : "secondary"} size="sm" onClick={() => { setStatus(status === filter ? "" : filter); setPage(1); }}>
                  <Filter className="h-3.5 w-3.5" />{filter}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setDepartment(""); setType(""); setStatus(""); setAiFilter(""); setPeriod("all"); setPage(1); }}>Xóa lọc</Button>
            </div>
            <div className="flex rounded-xl border bg-white p-1">
              <ViewButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} label="Grid"><Grid2X2 className="h-4 w-4" /></ViewButton>
              <ViewButton active={viewMode === "list"} onClick={() => setViewMode("list")} label="List"><List className="h-4 w-4" /></ViewButton>
              <ViewButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} label="Kanban"><Columns3 className="h-4 w-4" /></ViewButton>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-teal-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-900">
              <SlidersHorizontal className="h-4 w-4" />AI Filter
            </div>
            <Input value={aiFilter} onChange={(event) => { setAiFilter(event.target.value); setPage(1); }} placeholder='Ví dụ: "chứng chỉ tháng 1 năm 2026", "quý 1", "dưới 24 tiết", "sắp hết hạn trong 60 ngày"' />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Hiển thị {filtered.length ? pageStart + 1 : 0}-{pageEnd} / {filtered.length} chứng chỉ</span>
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

      {selectedIds.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 text-sm shadow-sm">
          <span className="font-semibold text-slate-700">Đã chọn {selectedIds.length}</span>
          <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("Chờ duyệt")}>Chờ duyệt</Button>
          <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("Đã duyệt")}>Duyệt</Button>
          <Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("Thiếu thông tin")}>Thiếu thông tin</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}>Xóa</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
        </div>
      ) : null}

      {viewMode === "grid" ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {paged.map((certificate) => (
            <div key={certificate.id} className="relative">
              <label className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 shadow-sm ring-1 ring-teal-100">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(certificate.id)}
                  onChange={() => setSelectedIds((ids) => ids.includes(certificate.id) ? ids.filter((id) => id !== certificate.id) : [...ids, certificate.id])}
                  aria-label={`Chọn ${certificate.title}`}
                  className="h-4 w-4 accent-teal-600"
                />
              </label>
              <CertificateCard
                certificate={certificate}
                onView={() => openDrawer(certificate, "view")}
                onZoom={() => { setZoomed(certificate); setZoom(1); setRotation(0); }}
                onApprove={() => approve(certificate)}
                onDelete={() => setDeleteTarget({ type: "single", certificate })}
                onDownload={() => downloadCsv(`${certificate.code}.csv`, [certificate])}
                onEdit={() => openDrawer(certificate, "edit")}
              />
            </div>
          ))}
        </div>
      ) : null}

      {viewMode === "list" ? (
        <CertificateList
          pageCertificates={paged}
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
            const pageIds = paged.map((item) => item.id);
            const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
            setSelectedIds(allPageSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
          }}
          onView={(item) => openDrawer(item, "view")}
          onEdit={(item) => openDrawer(item, "edit")}
          onApprove={approve}
          onDelete={(item) => setDeleteTarget({ type: "single", certificate: item })}
        />
      ) : null}

      {viewMode === "kanban" ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {kanbanColumns.map((column) => (
            <div
              key={column}
              className="min-h-[420px] w-80 flex-none rounded-2xl border bg-slate-50 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const certificateId = event.dataTransfer.getData("text/plain");
                if (certificateId) moveToStatus(certificateId, column);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">{column}</div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{filtered.filter((item) => item.status === column).length}</span>
              </div>
              <div className="space-y-3">
                {paged.filter((item) => item.status === column).map((certificate) => (
                  <button
                    key={certificate.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", certificate.id)}
                    onClick={() => openDrawer(certificate, "view")}
                    className="w-full cursor-grab rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 active:cursor-grabbing"
                  >
                    <div className="line-clamp-2 font-semibold text-slate-950">{certificate.title}</div>
                    <div className="mt-2 text-sm text-slate-500">{certificate.holder}</div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span>{formatDate(certificate.issuedDate)}</span>
                      <span className="font-semibold">{certificate.hours} tiết</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={() => setSelected(null)}>
          <aside className="ml-auto flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white/95 px-6 py-4 backdrop-blur">
              <div className="min-w-0">
                <div className="text-sm font-semibold uppercase text-teal-700">{drawerMode === "edit" ? "Sửa chứng chỉ" : "Chi tiết chứng chỉ"}</div>
                <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-7 text-slate-950">{selected.title}</h2>
              </div>
              <div className="flex gap-2">
                {drawerMode === "view" ? <Button variant="secondary" onClick={() => setDrawerMode("edit")}><Edit3 className="h-4 w-4" />Sửa</Button> : null}
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Đóng"><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {drawerMode === "view" ? <CertificateDetail certificate={selected} onZoom={() => { setZoomed(selected); setZoom(1); setRotation(0); }} /> : <CertificateEditForm certificate={selected} onSubmit={saveEdit} onCancel={() => setDrawerMode("view")} />}
            </div>
          </aside>
        </div>
      ) : null}

      {zoomed ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/85 p-4 backdrop-blur-sm" onClick={() => setZoomed(null)}>
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{zoomed.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">Zoom {Math.round(zoom * 100)}% · Xoay {rotation}°</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" className="viewer-button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Thu nhỏ"><ZoomOut className="h-4 w-4" /></button>
                <button type="button" className="viewer-button min-w-16 text-xs font-semibold" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
                <button type="button" className="viewer-button" onClick={() => setZoom((value) => Math.min(4, value + 0.25))} aria-label="Phóng to"><ZoomIn className="h-4 w-4" /></button>
                <div className="mx-1 h-6 w-px bg-white/15" />
                <button type="button" className="viewer-button" onClick={() => setRotation((value) => value - 90)} aria-label="Xoay trái"><RotateCcw className="h-4 w-4" /></button>
                <button type="button" className="viewer-button" onClick={() => setRotation((value) => value + 90)} aria-label="Xoay phải"><RotateCw className="h-4 w-4" /></button>
                <button type="button" className="viewer-button px-3 text-xs font-semibold" onClick={() => { setZoom(1); setRotation(0); }}>Reset</button>
                <button type="button" className="viewer-button" onClick={() => setZoomed(null)} aria-label="Đóng"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-6">
              <div className="flex min-h-full min-w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- Certificate previews can be blob URLs from local uploads. */}
                <img
                  src={zoomed.thumbnail || "/placeholder-certificate.svg"}
                  alt={zoomed.title}
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                  className="max-h-[78vh] max-w-[92vw] origin-center rounded-xl object-contain shadow-2xl transition-transform"
                  onError={(event) => {
                    event.currentTarget.src = "/placeholder-certificate.svg";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          target={deleteTarget}
          certificates={items}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
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
    </>
  );
}

function DeleteConfirmDialog({
  target,
  certificates,
  onCancel,
  onConfirm
}: {
  target: DeleteTarget;
  certificates: DemoCertificate[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedCertificates = target.type === "single"
    ? [target.certificate]
    : certificates.filter((certificate) => target.ids.includes(certificate.id));
  const count = selectedCertificates.length;
  const approvedCount = selectedCertificates.filter((certificate) => certificate.status === "Đã duyệt").length;
  const title = target.type === "single" ? "Xóa chứng chỉ này?" : `Xóa ${count} chứng chỉ đã chọn?`;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Thao tác này sẽ xóa dữ liệu chứng chỉ, bao gồm thông tin OCR, trạng thái duyệt và ảnh đính kèm đã lưu.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {approvedCount ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              Có {approvedCount} chứng chỉ đã duyệt. Nên cân nhắc chuyển trạng thái hoặc lưu trữ thay vì xóa nếu đây là dữ liệu thật.
            </div>
          ) : null}
          <div className="max-h-48 overflow-y-auto rounded-2xl border bg-slate-50">
            {selectedCertificates.map((certificate) => (
              <div key={certificate.id} className="flex items-start justify-between gap-3 border-b p-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900">{certificate.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{certificate.holder} · {certificate.code}</div>
                </div>
                <StatusBadge status={certificate.status} />
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Gợi ý: nếu chỉ cần loại khỏi chu kỳ, hãy bấm Hủy rồi sửa chứng chỉ và đổi trạng thái/thông tin thay vì xóa.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4" />
            Xóa {count > 1 ? `${count} chứng chỉ` : "chứng chỉ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CertificateDetail({ certificate, onZoom }: { certificate: DemoCertificate; onZoom: () => void }) {
  return (
    <>
      <button onClick={onZoom} className="group relative block w-full overflow-hidden rounded-2xl border bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- Certificate previews can be blob URLs from local uploads. */}
        <img
          src={certificate.thumbnail || "/placeholder-certificate.svg"}
          alt={certificate.title}
          className="h-80 w-full object-contain"
          onError={(event) => {
            event.currentTarget.src = "/placeholder-certificate.svg";
          }}
        />
        <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/75 px-3 py-2 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Zoom ảnh
        </div>
      </button>
      <div className="mt-5 space-y-3 text-sm">
        <div><StatusBadge status={certificate.status} /></div>
        {certificateFields(certificate).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b pb-3">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-semibold text-slate-900">{value}</span>
          </div>
        ))}
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold text-slate-900">Nội dung khóa học</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{certificate.courseContent || "Chưa cập nhật"}</p>
        </div>
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer font-semibold">Lịch sử OCR / chỉnh sửa</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{certificate.rawText || "OCR mock đã đọc dữ liệu mẫu. Chưa có lịch sử chỉnh sửa."}</pre>
        </details>
      </div>
    </>
  );
}

function CertificateEditForm({ certificate, onSubmit, onCancel }: { certificate: DemoCertificate; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4">
      <div className="rounded-2xl border bg-teal-50/40 p-4">
        <div className="mb-3 text-sm font-semibold text-teal-900">Thông tin kiểm duyệt</div>
        <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số giấy chứng nhận"><Input name="certificateNumber" defaultValue={certificate.certificateNumber || certificate.code} /></Field>
        <Field label="Trạng thái">
          <select name="status" defaultValue={certificate.status} className="h-10 w-full rounded-xl border bg-white px-3 text-sm">{quickFilters.map((item) => <option key={item}>{item}</option>)}</select>
        </Field>
        <Field className="sm:col-span-2" label="Ảnh/PDF chứng chỉ">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- Certificate previews can be data URLs from local uploads. */}
              <img
                src={certificate.thumbnail || "/placeholder-certificate.svg"}
                alt={certificate.title}
                className="h-28 w-24 rounded-xl border bg-white object-cover"
                onError={(event) => {
                  event.currentTarget.src = "/placeholder-certificate.svg";
                }}
              />
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-teal-200 transition hover:bg-teal-50">
                <ImageUp className="h-4 w-4" />
                Chọn ảnh thay thế
                <input name="thumbnailFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">Nếu ảnh bị lỗi, vào Sửa chứng chỉ và chọn ảnh thay thế tại đây.</p>
          </div>
        </Field>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">Thông tin người được cấp</div>
        <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Tên chứng chỉ"><Input name="title" defaultValue={certificate.title} /></Field>
        <Field label="Người được cấp"><Input name="holder" defaultValue={certificate.holder} /></Field>
        <Field label="Ngày sinh"><Input name="holderBirthDate" defaultValue={certificate.holderBirthDate || ""} /></Field>
        <Field className="sm:col-span-2" label="Địa chỉ / Đơn vị"><Input name="holderAddress" defaultValue={certificate.holderAddress || ""} /></Field>
        <Field label="Khoa/phòng"><Input name="department" defaultValue={certificate.department} /></Field>
        <Field label="Chức danh"><Input name="position" defaultValue={certificate.position} /></Field>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">Nội dung đào tạo và cấp chứng nhận</div>
        <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Loại chứng chỉ"><Input name="type" defaultValue={certificate.type} /></Field>
        <Field label="Hình thức"><Input name="learningFormat" defaultValue={certificate.learningFormat || ""} /></Field>
        <Field className="sm:col-span-2" label="Nội dung khóa học"><textarea name="courseContent" defaultValue={certificate.courseContent || ""} className="min-h-28 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
        <Field label="Từ ngày học"><Input name="studyStartDate" defaultValue={certificate.studyStartDate || ""} /></Field>
        <Field label="Đến ngày học"><Input name="studyEndDate" defaultValue={certificate.studyEndDate || ""} /></Field>
        <Field label="Số tiết"><Input name="hours" type="number" defaultValue={certificate.hours} /></Field>
        <Field label="Quy đổi tín chỉ"><Input name="equivalentCredits" type="number" defaultValue={certificate.equivalentCredits ?? ""} /></Field>
        <Field label="Đơn vị chịu trách nhiệm"><Input name="responsibleUnit" defaultValue={certificate.responsibleUnit || ""} /></Field>
        <Field label="Đơn vị cấp"><Input name="issuer" defaultValue={certificate.issuer} /></Field>
        <Field label="Nơi cấp"><Input name="issuePlace" defaultValue={certificate.issuePlace || ""} /></Field>
        <Field label="Ngày cấp"><Input name="issuedDate" defaultValue={certificate.issuedDate} /></Field>
        <Field label="Ngày hết hạn"><Input name="expiredDate" defaultValue={certificate.expiredDate || ""} /></Field>
        <Field className="sm:col-span-2" label="Số chứng thực / quyển số"><Input name="verificationNumber" defaultValue={certificate.verificationNumber || ""} /></Field>
        </div>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white py-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
        <Button type="submit"><Save className="h-4 w-4" />Lưu thay đổi</Button>
      </div>
    </form>
  );
}

function CertificateList({
  pageCertificates,
  selectedIds,
  sortConfig,
  onSort,
  onToggle,
  onToggleAll,
  onView,
  onEdit,
  onApprove,
  onDelete
}: {
  pageCertificates: DemoCertificate[];
  selectedIds: string[];
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onView: (item: DemoCertificate) => void;
  onEdit: (item: DemoCertificate) => void;
  onApprove: (item: DemoCertificate) => void;
  onDelete: (item: DemoCertificate) => void;
}) {
  const allChecked = pageCertificates.length > 0 && pageCertificates.every((certificate) => selectedIds.includes(certificate.id));

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
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 bg-teal-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4">
                <input type="checkbox" checked={allChecked} onChange={onToggleAll} aria-label="Chọn tất cả" className="h-4 w-4 rounded border-teal-300 accent-teal-600" />
              </th>
              <SortHeader label="Chứng chỉ" sortKey="title" />
              <SortHeader label="Người được cấp" sortKey="holder" />
              <SortHeader label="Ngày cấp" sortKey="issuedDate" />
              <SortHeader label="Thời gian học" sortKey="studyStartDate" />
              <SortHeader label="Số tiết" sortKey="hours" />
              <SortHeader label="Trạng thái" sortKey="status" />
              <th className="pr-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {pageCertificates.map((certificate) => (
              <tr key={certificate.id} className="hover:bg-teal-50/40">
                <td className="p-4">
                  <input type="checkbox" checked={selectedIds.includes(certificate.id)} onChange={() => onToggle(certificate.id)} aria-label={`Chọn ${certificate.title}`} className="h-4 w-4 rounded border-teal-300 accent-teal-600" />
                </td>
                <td className="px-4"><div className="font-semibold text-slate-950">{certificate.title}</div><div className="text-xs text-slate-500">{certificate.code}</div></td>
                <td className="px-4">{certificate.holder}</td>
                <td className="px-4">{formatDate(certificate.issuedDate)}</td>
                <td className="px-4">{formatDate(certificate.studyStartDate)} - {formatDate(certificate.studyEndDate)}</td>
                <td className="px-4 font-semibold">{certificate.hours}</td>
                <td className="px-4"><StatusBadge status={certificate.status} /></td>
                <td className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(certificate)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(certificate)}><Edit3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onApprove(certificate)}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(certificate)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
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

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">
      {options.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}
    </select>
  );
}

function ViewButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`flex h-9 w-10 items-center justify-center rounded-lg transition ${active ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-teal-50"}`}>
      {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function certificateFields(certificate: DemoCertificate): Array<[string, React.ReactNode]> {
  return [
    ["Người sở hữu", certificate.holder],
    ["Ngày sinh", certificate.holderBirthDate || "Chưa cập nhật"],
    ["Địa chỉ/Đơn vị", certificate.holderAddress || "Chưa cập nhật"],
    ["Khoa/phòng", certificate.department],
    ["Chức danh", certificate.position],
    ["Loại chứng chỉ", certificate.type],
    ["Số giấy chứng nhận", certificate.certificateNumber || certificate.code],
    ["Hình thức", certificate.learningFormat || "Chưa cập nhật"],
    ["Đơn vị chịu trách nhiệm", certificate.responsibleUnit || "Chưa cập nhật"],
    ["Từ ngày học", formatDate(certificate.studyStartDate)],
    ["Đến ngày học", formatDate(certificate.studyEndDate)],
    ["Đơn vị cấp", certificate.issuer],
    ["Nơi cấp", certificate.issuePlace || "Chưa cập nhật"],
    ["Ngày cấp", formatDate(certificate.issuedDate)],
    ["Ngày hết hạn", formatDate(certificate.expiredDate)],
    ["Số tiết", certificate.hours],
    ["Số tiết tính chu kỳ", certificate.includeInCycle === false ? 0 : certificate.cycleCountedHours ?? certificate.hours],
    ["Ghi chú chu kỳ", certificate.cycleReason || (certificate.includeInCycle === false ? "Không cộng vào chu kỳ hiện tại." : "Được cộng vào chu kỳ hiện tại.")],
    ["Quy đổi tín chỉ", certificate.equivalentCredits ?? "Chưa cập nhật"],
    ["Số chứng thực / quyển số", certificate.verificationNumber || "Chưa cập nhật"],
    ["Mã chứng chỉ", certificate.code],
    ["File lưu trữ", certificate.fileUrl || "Chưa có file upload"],
    ["OCR", `${certificate.ocrStatus} · ${Math.round(certificate.confidence * 100)}%`]
  ];
}

function matchesDate(certificate: DemoCertificate, field: DateField, period: Period, options: { month: string; quarter: string; year: string; dateFrom: string; dateTo: string }) {
  if (period === "all") return true;
  const raw = certificate[field];
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const time = startOfDay(date);
  const today = new Date();

  if (period === "today") return time === startOfDay(today);
  if (period === "month") {
    const [year, month] = options.month.split("-").map(Number);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  }
  if (period === "quarter") {
    const [yearText, quarterText] = options.quarter.split("-Q");
    const quarter = Number(quarterText);
    return date.getFullYear() === Number(yearText) && Math.floor(date.getMonth() / 3) + 1 === quarter;
  }
  if (period === "year") return date.getFullYear() === Number(options.year);
  if (period === "custom") {
    const from = options.dateFrom ? startOfDay(new Date(options.dateFrom)) : Number.NEGATIVE_INFINITY;
    const to = options.dateTo ? startOfDay(new Date(options.dateTo)) : Number.POSITIVE_INFINITY;
    return time >= from && time <= to;
  }
  return true;
}

function applyNaturalFilter(certificate: DemoCertificate, query: string) {
  const lower = query.toLowerCase();
  if (lower.includes("sắp hết hạn")) return certificate.status === "Sắp hết hạn";
  if (lower.includes("chờ duyệt")) return certificate.status === "Chờ duyệt";
  if (lower.includes("đã hết hạn")) return certificate.status === "Đã hết hạn";
  if (lower.includes("thiếu")) return certificate.status === "Thiếu thông tin";
  if (lower.includes("dưới 24")) return certificate.hours < 24;
  if (lower.includes("quý 1") || lower.includes("q1")) return matchesDate(certificate, "issuedDate", "quarter", { month: "", quarter: "2026-Q1", year: "2026", dateFrom: "", dateTo: "" });
  if (lower.includes("tháng 1") || lower.includes("thang 1")) return matchesDate(certificate, "issuedDate", "month", { month: "2026-01", quarter: "", year: "2026", dateFrom: "", dateTo: "" });
  if (lower.includes("năm 2026") || lower.includes("nam 2026")) return matchesDate(certificate, "issuedDate", "year", { month: "", quarter: "", year: "2026", dateFrom: "", dateTo: "" });
  if (lower.includes("kiểm soát nhiễm khuẩn")) return certificate.title.toLowerCase().includes("kiểm soát nhiễm khuẩn") || certificate.type.toLowerCase().includes("kiểm soát nhiễm khuẩn");
  return true;
}

async function uploadFileToServer(file: File) {
  const formData = new FormData();
  formData.append("files", file);
  const response = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await response.json();
  return data.files?.[0] as { fileName: string; url: string; thumbnailUrl?: string; sizeBytes: number; mimeType: string } | undefined;
}
