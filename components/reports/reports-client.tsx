"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, Columns3, Download, Eye, FileSpreadsheet, Grid2X2, Link2, List, Plus, QrCode, Search, Share2, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DemoCertificate, DemoEmployee, downloadCsv } from "@/lib/demo-store";
import { reports as seedReports } from "@/lib/mock-data";

type ViewMode = "list" | "grid" | "kanban";
type ReportStatus = "Sẵn sàng" | "Đã chia sẻ" | "Cần cập nhật";
type ReportTemplate = {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
  status: ReportStatus;
  description: string;
};
type ReportRow = Record<string, string | number>;

const reportStatuses: ReportStatus[] = ["Sẵn sàng", "Đã chia sẻ", "Cần cập nhật"];
const reportTypes = ["Tổng hợp", "Khoa/phòng", "Cảnh báo", "Chứng chỉ", "CCHN"];
const reportColumnLabels: Record<string, string> = {
  id: "Mã hồ sơ",
  code: "Mã chứng chỉ",
  title: "Tên chứng chỉ",
  holder: "Người được cấp",
  name: "Nhân sự",
  department: "Khoa/phòng",
  position: "Chức danh",
  licenseNumber: "Số CCHN",
  approvedHours: "Số tiết được tính",
  requiredHours: "Số tiết yêu cầu",
  missingHours: "Số tiết còn thiếu",
  compliant: "Trạng thái tuân thủ",
  issuedDate: "Ngày cấp",
  expiredDate: "Ngày hết hạn",
  status: "Trạng thái",
  hours: "Số tiết"
};
const hiddenPreviewColumns = new Set(["__type"]);

const templates: ReportTemplate[] = [
  ...seedReports.map((report, index) => ({
    id: report.id,
    name: report.name,
    type: report.type,
    updatedAt: report.updatedAt,
    status: (index === 1 ? "Đã chia sẻ" : "Sẵn sàng") as ReportStatus,
    description: "Báo cáo chuẩn có bộ lọc, xem trước dữ liệu, xuất file và chia sẻ có kiểm soát."
  })),
  { id: "r4", name: "Báo cáo nhân sự chưa đủ điều kiện", type: "Tổng hợp", updatedAt: "2026-05-20", status: "Cần cập nhật", description: "Danh sách nhân sự còn thiếu số tiết trong chu kỳ hiện hành." },
  { id: "r5", name: "Báo cáo nhân sự chưa có CCHN", type: "CCHN", updatedAt: "2026-05-19", status: "Sẵn sàng", description: "Theo dõi hồ sơ thiếu số chứng chỉ hành nghề." },
  { id: "r6", name: "Báo cáo chứng chỉ theo loại", type: "Chứng chỉ", updatedAt: "2026-05-18", status: "Sẵn sàng", description: "Nhóm chứng chỉ theo loại, trạng thái và khoa/phòng." }
];

export function ReportsClient() {
  const [reportMode, setReportMode] = useState("compliance");
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [certificates, setCertificates] = useState<DemoCertificate[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("2026");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [hiddenRows, setHiddenRows] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [drawerReport, setDrawerReport] = useState<ReportTemplate | null>(null);
  const [quickViewRow, setQuickViewRow] = useState<ReportRow | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [notice, setNotice] = useState("");

  React.useEffect(() => {
    Promise.all([
      fetch("/api/employees").then((res) => res.ok ? res.json() : { data: [] }),
      fetch("/api/certificates").then((res) => res.ok ? res.json() : { data: [] })
    ]).then(([emp, cert]) => {
      setEmployees(Array.isArray(emp.data) ? emp.data : []);
      setCertificates(Array.isArray(cert.data) ? cert.data : []);
    }).catch(() => {
      setEmployees([]);
      setCertificates([]);
    });
  }, []);

  const reportRows = useMemo(() => {
    let rows = buildRows(reportMode, department, employees, certificates);
    
    // 1. Lọc bỏ các dòng đã ẩn (Loại bỏ tạm thời khỏi preview)
    if (hiddenRows.length > 0) {
      rows = rows.filter((_, index) => !hiddenRows.includes(index));
    }

    // 2. Sắp xếp (Sorting)
    if (sortConfig) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === undefined || bVal === undefined) return 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return rows;
  }, [department, reportMode, hiddenRows, sortConfig, employees, certificates]);
  const departmentOptions = useMemo(() => Array.from(new Set([
    ...employees.map((employee) => employee.department),
    ...certificates.map((certificate) => certificate.department)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [certificates, employees]);

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return templates.filter((report) => {
      const haystack = `${report.name} ${report.type} ${report.status} ${report.description}`.toLowerCase();
      return (!normalized || haystack.includes(normalized)) && (!status || report.status === status);
    });
  }, [query, status]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredReports.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filteredReports.length);
  const pagedReports = filteredReports.slice(pageStart, pageEnd);

  const previewTotalPages = Math.max(1, Math.ceil(reportRows.length / previewPageSize));
  const currentPreviewPage = Math.min(previewPage, previewTotalPages);
  const previewStart = reportRows.length ? (currentPreviewPage - 1) * previewPageSize : 0;
  const previewEnd = Math.min(previewStart + previewPageSize, reportRows.length);
  const pagedRows = reportRows.slice(previewStart, previewEnd);

  const selectedReportRows = selectedRows.length ? reportRows.filter((_, index) => selectedRows.includes(index)) : reportRows;
  const selectedReportTemplates = selectedReports.length ? templates.filter((report) => selectedReports.includes(report.id)) : filteredReports;

  const resetFilters = () => {
    setQuery("");
    setDepartment("");
    setStatus("");
    setYear("2026");
    setPage(1);
    setPreviewPage(1);
  };

  const share = (reportName: string) => {
    const url = `${window.location.origin}/reports?shared=${encodeURIComponent(reportName)}&expires=2026-12-31`;
    void navigator.clipboard?.writeText(url);
    setNotice(`Đã tạo link chia sẻ và sao chép: ${url}`);
  };

  const createQr = (reportName: string) => {
    setNotice(`Đã tạo QR/link xác minh cho báo cáo: ${reportName}.`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Báo cáo"
        title="Thống kê, tạo báo cáo và chia sẻ"
        description="Theo dõi tuân thủ theo chu kỳ, rà soát minh chứng, xuất dữ liệu và chia sẻ báo cáo có kiểm soát."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv(selectedRows.length ? "du-lieu-bao-cao-da-chon.csv" : "du-lieu-bao-cao.csv", localizeReportRows(selectedReportRows))}>
              <Download className="h-4 w-4" />{selectedRows.length ? `Export ${selectedRows.length} dòng` : "Export dữ liệu"}
            </Button>
            <Button onClick={() => setShowCreateDrawer(true)}><Plus className="h-4 w-4" />Tạo báo cáo</Button>
          </>
        }
      />

      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<FileSpreadsheet className="h-6 w-6 text-teal-700" />} value={`${templates.length}`} label="Báo cáo mẫu" />
        <MetricCard icon={<Share2 className="h-6 w-6 text-emerald-700" />} value={`${templates.filter((report) => report.status === "Đã chia sẻ").length}`} label="Đã chia sẻ" />
        <MetricCard icon={<CalendarClock className="h-6 w-6 text-amber-700" />} value={year} label="Năm/chu kỳ đang lọc" />
        <MetricCard icon={<BarChart3 className="h-6 w-6 text-sky-700" />} value={`${reportRows.length}`} label="Dòng dữ liệu preview" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr_180px_160px_160px]">
            <select value={reportMode} onChange={(event) => { setReportMode(event.target.value); setPreviewPage(1); setSelectedRows([]); }} className="h-10 rounded-xl border bg-white px-3 text-sm">
              <option value="compliance">Tuân thủ theo nhân sự</option>
              <option value="certificates">Danh sách chứng chỉ</option>
              <option value="expiring">Chứng chỉ sắp hết hạn</option>
              <option value="missingLicense">Nhân sự chưa có CCHN</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-9" placeholder="Tìm báo cáo, loại, trạng thái..." />
            </div>
            <Select value={department} onChange={(value) => { setDepartment(value); setPreviewPage(1); }} options={["", ...departmentOptions]} labels={{ "": "Tất cả khoa/phòng" }} />
            <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Năm/chu kỳ" />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={["", ...reportStatuses]} labels={{ "": "Tất cả trạng thái" }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {reportTypes.map((item) => (
                <Button key={item} variant={query === item ? "default" : "secondary"} size="sm" onClick={() => { setQuery(query === item ? "" : item); setPage(1); }}>{item}</Button>
              ))}
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

      {selectedReports.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 text-sm shadow-sm">
          <span className="font-semibold text-slate-700">Đã chọn {selectedReports.length} báo cáo</span>
          <Button size="sm" variant="secondary" onClick={() => downloadCsv("bao-cao-da-chon.csv", selectedReportTemplates)}>Export danh sách</Button>
          <Button size="sm" variant="secondary" onClick={() => share(`${selectedReports.length} báo cáo đã chọn`)}><Link2 className="h-4 w-4" />Tạo link</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedReports([])}>Bỏ chọn</Button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Hiển thị {filteredReports.length ? pageStart + 1 : 0}-{pageEnd} / {filteredReports.length} báo cáo</span>
        <PaginationControls page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      </div>

      {viewMode === "list" ? (
        <ReportList
          reports={pagedReports}
          selectedIds={selectedReports}
          onToggle={(id) => setSelectedReports((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onToggleAll={() => {
            const pageIds = pagedReports.map((report) => report.id);
            const allPageSelected = pageIds.every((id) => selectedReports.includes(id));
            setSelectedReports(allPageSelected ? selectedReports.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedReports, ...pageIds])));
          }}
          onView={setDrawerReport}
          onExport={(report) => downloadCsv(`${report.id}.csv`, localizeReportRows(reportRows))}
          onShare={(report) => share(report.name)}
          onQr={(report) => createQr(report.name)}
        />
      ) : null}

      {viewMode === "grid" ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {pagedReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              checked={selectedReports.includes(report.id)}
              onToggle={() => setSelectedReports((ids) => ids.includes(report.id) ? ids.filter((id) => id !== report.id) : [...ids, report.id])}
              onView={() => setDrawerReport(report)}
              onExport={() => downloadCsv(`${report.id}.csv`, localizeReportRows(reportRows))}
              onShare={() => share(report.name)}
              onQr={() => createQr(report.name)}
            />
          ))}
        </div>
      ) : null}

      {viewMode === "kanban" ? (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {reportStatuses.map((column) => (
            <div key={column} className="min-h-[360px] w-80 flex-none rounded-2xl border bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-900">{column}</div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{filteredReports.filter((report) => report.status === column).length}</span>
              </div>
              <div className="space-y-3">
                {pagedReports.filter((report) => report.status === column).map((report) => (
                  <div key={report.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setDrawerReport(report)} className="line-clamp-2 text-left font-semibold text-slate-950">{report.name}</button>
                      <input type="checkbox" checked={selectedReports.includes(report.id)} onChange={() => setSelectedReports((ids) => ids.includes(report.id) ? ids.filter((id) => id !== report.id) : [...ids, report.id])} className="h-4 w-4 accent-teal-600" aria-label={`Chọn ${report.name}`} />
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{report.type} · {report.updatedAt}</div>
                    <div className="mt-3 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => downloadCsv(`${report.id}.csv`, localizeReportRows(reportRows))}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => share(report.name)}><Link2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => createQr(report.name)}><QrCode className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Xem trước dữ liệu</h2>
              <p className="mt-1 text-sm text-slate-500">Hiển thị {reportRows.length ? previewStart + 1 : 0}-{previewEnd} / {reportRows.length} dòng. Tick dòng để export riêng.</p>
            </div>
            <PaginationControls page={currentPreviewPage} totalPages={previewTotalPages} pageSize={previewPageSize} onPageChange={setPreviewPage} onPageSizeChange={(value) => { setPreviewPageSize(value); setPreviewPage(1); }} />
          </div>
          {selectedRows.length || hiddenRows.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-teal-50 p-3 text-sm">
              {selectedRows.length ? (
                <>
                  <span className="font-semibold text-teal-900">Đã chọn {selectedRows.length} dòng dữ liệu</span>
                  <Button size="sm" variant="secondary" onClick={() => downloadCsv("du-lieu-bao-cao-da-chon.csv", localizeReportRows(selectedReportRows))}>Export dòng đã chọn</Button>
                </>
              ) : null}
              {hiddenRows.length ? (
                <Button size="sm" variant="secondary" className="border-teal-200 text-teal-700 hover:bg-teal-100" onClick={() => setHiddenRows([])}>
                  Hiện lại {hiddenRows.length} dòng đã ẩn
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => { setSelectedRows([]); setHiddenRows([]); }}>Bỏ chọn & hiện tất cả</Button>
            </div>
          ) : null}
          <PreviewTable
            rows={pagedRows}
            rowOffset={previewStart}
            selectedRows={selectedRows}
            sortConfig={sortConfig}
            onSort={(key) => {
              setSortConfig((prev) => {
                if (prev?.key === key) {
                  return prev.direction === "asc" ? { key, direction: "desc" } : null;
                }
                return { key, direction: "asc" };
              });
            }}
            onHide={(index) => setHiddenRows((prev) => [...prev, index])}
            onQuickView={(row) => setQuickViewRow(row)}
            onToggle={(index) => setSelectedRows((ids) => ids.includes(index) ? ids.filter((item) => item !== index) : [...ids, index])}
            onToggleAll={() => {
              const pageIndexes = pagedRows.map((_, index) => previewStart + index);
              const allPageSelected = pageIndexes.every((index) => selectedRows.includes(index));
              setSelectedRows(allPageSelected ? selectedRows.filter((index) => !pageIndexes.includes(index)) : Array.from(new Set([...selectedRows, ...pageIndexes])));
            }}
          />
        </CardContent>
      </Card>

      {quickViewRow ? (
        <QuickViewDrawer 
          row={quickViewRow} 
          onClose={() => setQuickViewRow(null)} 
        />
      ) : null}

      {drawerReport ? (
        <ReportDrawer
          report={drawerReport}
          rows={reportRows}
          onClose={() => setDrawerReport(null)}
          onExport={() => downloadCsv(`${drawerReport.id}.csv`, localizeReportRows(reportRows))}
          onShare={() => share(drawerReport.name)}
          onQr={() => createQr(drawerReport.name)}
        />
      ) : null}

      {showCreateDrawer ? (
        <CreateReportDrawer
          onClose={() => setShowCreateDrawer(false)}
          onCreate={(name) => {
            setShowCreateDrawer(false);
            setNotice(`Đã tạo cấu hình báo cáo: ${name}.`);
          }}
        />
      ) : null}
    </>
  );
}

function buildRows(reportMode: string, department: string, employees: DemoEmployee[], certificates: DemoCertificate[]): ReportRow[] {
  if (reportMode === "certificates" || reportMode === "expiring") {
    return certificates
      .filter((item) => !department || item.department === department)
      .filter((item) => reportMode !== "expiring" || item.status === "Sắp hết hạn" || item.status === "Đã hết hạn")
      .map((item) => ({
        id: item.id,
        __type: "certificate",
        code: item.code,
        title: item.title,
        holder: item.holder,
        department: item.department,
        issuedDate: item.issuedDate,
        expiredDate: item.expiredDate || "",
        status: item.status,
        hours: item.hours
      }));
  }
  return employees
    .filter((item) => !department || item.department === department)
    .filter((item) => reportMode !== "missingLicense" || !item.licenseNumber)
    .map((item) => ({
      id: item.id,
      __type: "employee",
      name: item.name,
      department: item.department,
      position: item.position,
      licenseNumber: item.licenseNumber || "Chưa cập nhật",
      approvedHours: item.hours,
      requiredHours: item.requiredHours,
      missingHours: Math.max(item.requiredHours - item.hours, 0),
      compliant: item.hours >= item.requiredHours ? "Đạt" : "Chưa đạt"
    }));
}

function localizeReportRows(rows: ReportRow[]) {
  return rows.map((row) => {
    const localized: Record<string, string | number> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (hiddenPreviewColumns.has(key)) return;
      localized[reportColumnLabels[key] ?? key] = value;
    });
    return localized;
  });
}

function isStatusColumn(key: string) {
  return key === "status" || key === "compliant";
}

function MetricCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <Card><CardContent className="p-5">{icon}<div className="mt-3 text-2xl font-bold">{value}</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>;
}

function ReportCard({ report, checked, onToggle, onView, onExport, onShare, onQr }: { report: ReportTemplate; checked: boolean; onToggle: () => void; onView: () => void; onExport: () => void; onShare: () => void; onQr: () => void }) {
  return (
    <Card className="border-teal-100 bg-white transition hover:-translate-y-0.5 hover:shadow-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onView} className="line-clamp-2 text-left text-lg font-bold text-slate-950">{report.name}</button>
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-teal-600" aria-label={`Chọn ${report.name}`} />
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{report.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">{report.type} · {report.updatedAt}</span>
          <StatusBadge status={report.status} />
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onExport}><Download className="h-4 w-4" />Excel</Button>
          <Button variant="secondary" size="sm" onClick={onShare}><Link2 className="h-4 w-4" />Link</Button>
          <Button variant="secondary" size="sm" onClick={onQr}><QrCode className="h-4 w-4" />QR</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportList({ reports, selectedIds, onToggle, onToggleAll, onView, onExport, onShare, onQr }: { reports: ReportTemplate[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onView: (report: ReportTemplate) => void; onExport: (report: ReportTemplate) => void; onShare: (report: ReportTemplate) => void; onQr: (report: ReportTemplate) => void }) {
  const allChecked = reports.length > 0 && reports.every((report) => selectedIds.includes(report.id));
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-teal-50 text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-4"><input type="checkbox" checked={allChecked} onChange={onToggleAll} className="h-4 w-4 accent-teal-600" aria-label="Chọn tất cả" /></th><th>Báo cáo</th><th>Loại</th><th>Cập nhật</th><th>Trạng thái</th><th className="pr-5">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y bg-white">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-teal-50/40">
                <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(report.id)} onChange={() => onToggle(report.id)} className="h-4 w-4 accent-teal-600" aria-label={`Chọn ${report.name}`} /></td>
                <td className="py-4"><button type="button" onClick={() => onView(report)} className="text-left font-semibold text-slate-950">{report.name}</button><div className="mt-1 line-clamp-1 text-xs text-slate-500">{report.description}</div></td>
                <td>{report.type}</td>
                <td>{report.updatedAt}</td>
                <td><StatusBadge status={report.status} /></td>
                <td className="pr-5"><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => onView(report)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onExport(report)}><Download className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onShare(report)}><Link2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onQr(report)}><QrCode className="h-4 w-4" /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PreviewTable({ 
  rows, 
  rowOffset, 
  selectedRows, 
  sortConfig,
  onSort,
  onHide,
  onQuickView,
  onToggle, 
  onToggleAll 
}: { 
  rows: ReportRow[]; 
  rowOffset: number; 
  selectedRows: number[]; 
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  onHide: (index: number) => void;
  onQuickView: (row: ReportRow) => void;
  onToggle: (index: number) => void; 
  onToggleAll: () => void 
}) {
  const headers = Object.keys(rows[0] ?? { empty: "" }).filter((key) => !hiddenPreviewColumns.has(key));
  const allChecked = rows.length > 0 && rows.every((_, index) => selectedRows.includes(rowOffset + index));
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-teal-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="p-3"><input type="checkbox" checked={allChecked} onChange={onToggleAll} className="h-4 w-4 accent-teal-600" aria-label="Chọn tất cả dòng" /></th>
            {headers.map((header) => (
              <th 
                key={header} 
                className="group cursor-pointer p-3 transition hover:text-teal-700"
                onClick={() => onSort(header)}
              >
                <div className="flex items-center gap-1">
                  <span>{reportColumnLabels[header] ?? header}</span>
                  <div className="flex flex-col">
                    <BarChart3 className={`h-3 w-3 transition ${sortConfig?.key === header ? (sortConfig.direction === 'asc' ? 'text-teal-600' : 'rotate-180 text-teal-600') : 'opacity-0 group-hover:opacity-40'}`} />
                  </div>
                </div>
              </th>
            ))}
            <th className="p-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {rows.map((row, index) => {
            const absoluteIndex = rowOffset + index;
            return (
              <tr key={absoluteIndex} className="hover:bg-teal-50/40">
                <td className="p-3"><input type="checkbox" checked={selectedRows.includes(absoluteIndex)} onChange={() => onToggle(absoluteIndex)} className="h-4 w-4 accent-teal-600" aria-label={`Chọn dòng ${absoluteIndex + 1}`} /></td>
                {headers.map((header) => (
                  <td key={header} className="p-3">
                    {isStatusColumn(header) ? <StatusBadge status={String(row[header] ?? "")} /> : String(row[header] ?? "")}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-teal-600" 
                      title="Xem chi tiết gốc"
                      onClick={() => onQuickView(row)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-500" 
                      title="Ẩn khỏi preview (không xoá data)"
                      onClick={() => onHide(absoluteIndex)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportDrawer({ report, rows, onClose, onExport, onShare, onQr }: { report: ReportTemplate; rows: ReportRow[]; onClose: () => void; onExport: () => void; onShare: () => void; onQr: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div><div className="text-sm font-semibold uppercase text-teal-700">Chi tiết báo cáo</div><h2 className="mt-1 text-2xl font-bold text-slate-950">{report.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{report.description}</p></div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Loại báo cáo" value={report.type} />
            <Info label="Trạng thái" value={report.status} />
            <Info label="Cập nhật" value={report.updatedAt} />
            <Info label="Dữ liệu preview" value={`${rows.length} dòng`} />
          </div>
          <div className="rounded-2xl border bg-teal-50 p-4 text-sm leading-6 text-teal-900">Báo cáo dùng để đối chiếu tình trạng tuân thủ theo chu kỳ, hỗ trợ xuất file, tạo link chia sẻ có hạn và truy vết đến hồ sơ gốc.</div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={onExport}><Download className="h-4 w-4" />Export</Button>
          <Button variant="secondary" onClick={onShare}><Link2 className="h-4 w-4" />Link</Button>
          <Button onClick={onQr}><QrCode className="h-4 w-4" />Tạo QR</Button>
        </div>
      </aside>
    </div>
  );
}

function CreateReportDrawer({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("Báo cáo đào tạo liên tục tùy chỉnh");
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div><div className="text-sm font-semibold uppercase text-teal-700">Tạo báo cáo</div><h2 className="mt-1 text-2xl font-bold text-slate-950">Báo cáo tùy chỉnh</h2></div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Field label="Tên báo cáo"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Loại báo cáo"><Select value="Tổng hợp" onChange={() => undefined} options={reportTypes} /></Field>
          <Field label="Ngày hết hạn link chia sẻ"><Input type="date" defaultValue="2026-12-31" /></Field>
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-600">Báo cáo lưu bộ lọc, cột dữ liệu và thời hạn chia sẻ để có thể tái sử dụng cho kiểm tra nội bộ hoặc gửi cơ quan quản lý.</div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={() => onCreate(name)}>Tạo báo cáo</Button>
        </div>
      </aside>
    </div>
  );
}

function QuickViewDrawer({ row, onClose }: { row: ReportRow; onClose: () => void }) {
  const router = useRouter();
  const title = String(row.name || row.title || row.code || "Chi tiết dữ liệu");
  const entries = Object.entries(row).filter(([key]) => key !== "__type");

  const handleEdit = () => {
    const id = String(row.id ?? "");
    const type = row.__type;
    const label = String(row.name || row.title || row.code || "");
    
    if (type === "employee") {
      const params = new URLSearchParams();
      if (id) params.set("edit", id);
      if (label) params.set("q", label);
      router.push(`/employees?${params.toString()}`);
    } else if (type === "certificate") {
      router.push(`/certificates?id=${encodeURIComponent(id)}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Xem nhanh dữ liệu gốc</div>
              <h2 className="text-xl font-bold text-slate-950">{title}</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-2xl border bg-slate-50/50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-400">{reportColumnLabels[key] ?? key}</div>
                <div className="mt-1 font-semibold text-slate-900">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-sm leading-6 text-teal-800">
            Dữ liệu này được trích xuất trực tiếp từ hồ sơ gốc trong hệ thống để đối chiếu. Bạn có thể chuyển đến trang quản lý tương ứng để chỉnh sửa nếu phát hiện sai sót.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button onClick={handleEdit}>Chỉnh sửa hồ sơ gốc</Button>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-semibold uppercase text-slate-400">{label}</div><div className="mt-1 font-semibold text-slate-950">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">{options.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}</select>;
}

function ViewButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className={`flex h-9 w-10 items-center justify-center rounded-lg transition ${active ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-teal-50"}`}>{children}</button>;
}

function PaginationControls({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: { page: number; totalPages: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-xl border bg-white px-2 text-sm">
        {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}/trang</option>)}
      </select>
      <span className="text-sm font-semibold text-slate-600">{page}/{totalPages}</span>
      <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></Button>
      <Button variant="secondary" size="icon" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}
