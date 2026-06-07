"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Grid2X2,
  Columns3,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readApiError } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import type { PortalCertificateData, PortalOverview } from "@/components/portal/portal-types";

type PortalCertificate = PortalCertificateData & {
  proposedCredits?: number | null;
  recognizedCredits?: number | null;
  holderBirthDate?: string | null;
  sourceType?: SourceType;
  adminNote?: string | null;
  createdAt?: string | null;
};

type PortalCertificateStatus =
  | "draft"
  | "submitted"
  | "needs_info"
  | "counted"
  | "not_counted"
  | "out_of_cycle"
  | "duplicate_suspected"
  | "cancelled";

type TabKey = "counted" | "out_of_cycle" | "needs_info" | "duplicate_suspected" | "all";
type SourceType = "external_certificate" | "internal_training" | "self_learning" | "professional_activity";
type ViewMode = "grid" | "list" | "kanban";

type UploadDraft = {
  sourceType: SourceType;
  title: string;
  certificateNumber: string;
  holderName: string;
  holderBirthDate: string;
  issuer: string;
  issuedDate: string;
  type: string;
  hours: string;
  courseContent: string;
  learningLink: string;
  reflection: string;
  internalActivity: string;
  activityDate: string;
  description: string;
  file: File | null;
};

type UploadedEvidence = {
  fileName: string;
  url: string;
  thumbnailUrl?: string;
  sizeBytes: number;
  mimeType: string;
};

type DeleteRequest = {
  ids: string[];
  title: string;
  description: string;
};

const initialDraft: UploadDraft = {
  sourceType: "external_certificate",
  title: "",
  certificateNumber: "",
  holderName: "",
  holderBirthDate: "",
  issuer: "",
  issuedDate: "",
  type: "Đào tạo liên tục",
  hours: "",
  courseContent: "",
  learningLink: "",
  reflection: "",
  internalActivity: "",
  activityDate: "",
  description: "",
  file: null
};

export function PortalCertificatesClient() {
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedCertificate, setSelectedCertificate] = useState<PortalCertificate | null>(null);
  const [editingCertificate, setEditingCertificate] = useState<PortalCertificate | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>(initialDraft);
  const [uploadedEvidence, setUploadedEvidence] = useState<UploadedEvidence | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrMessage, setOcrMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");

  const load = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/portal/overview", { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "PORTAL_OVERVIEW_FAILED");
      setOverview(payload.data);
    } catch {
      setOverview(null);
      setLoadError("Không tải được danh sách chứng chỉ cá nhân. Kiểm tra database hoặc tải lại trang.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const certificates = useMemo(() => (overview?.certificates ?? []) as PortalCertificate[], [overview]);

  const tabCounts = useMemo(() => {
    return certificates.reduce<Record<TabKey, number>>(
      (acc, certificate) => {
        const status = normalizeCertificateStatus(certificate);
        acc.all += 1;
        if (status === "counted") acc.counted += 1;
        if (status === "out_of_cycle" || status === "not_counted") acc.out_of_cycle += 1;
        if (status === "needs_info") acc.needs_info += 1;
        if (status === "duplicate_suspected") acc.duplicate_suspected += 1;
        return acc;
      },
      { counted: 0, out_of_cycle: 0, needs_info: 0, duplicate_suspected: 0, all: 0 }
    );
  }, [certificates]);

  const activityTypes = useMemo(() => Array.from(new Set(certificates.map((item) => item.type).filter((value): value is string => Boolean(value)))).sort(), [certificates]);
  const issueYears = useMemo(() => {
    return Array.from(new Set(certificates.map((item) => yearFromDate(item.issuedDate)).filter(Boolean) as string[])).sort((a, b) => Number(b) - Number(a));
  }, [certificates]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const status = normalizeCertificateStatus(certificate);
      const haystack = `${certificate.title} ${certificate.code} ${certificate.certificateNumber ?? ""} ${certificate.issuer ?? ""}`.toLowerCase();
      const inTab =
        activeTab === "all" ||
        (activeTab === "counted" && status === "counted") ||
        (activeTab === "out_of_cycle" && ["out_of_cycle", "not_counted"].includes(status)) ||
        (activeTab === "needs_info" && status === "needs_info") ||
        (activeTab === "duplicate_suspected" && status === "duplicate_suspected");

      return (
        inTab &&
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (!typeFilter || certificate.type === typeFilter) &&
        (!yearFilter || yearFromDate(certificate.issuedDate) === yearFilter) &&
        (!statusFilter || status === statusFilter)
      );
    });
  }, [activeTab, certificates, query, statusFilter, typeFilter, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, query, statusFilter, typeFilter, yearFilter, viewMode]);

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => filtered.some((certificate) => certificate.id === id)));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);

  const selectedCertificates = useMemo(
    () => certificates.filter((certificate) => selectedIds.includes(certificate.id)),
    [certificates, selectedIds]
  );

  const exportSelected = () => {
    const rows = selectedCertificates.length ? selectedCertificates : filtered;
    downloadCsv(selectedCertificates.length ? "chung-chi-cua-toi-da-chon.csv" : "chung-chi-cua-toi.csv", rows);
  };

  const removeCertificates = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(async (id) => {
        const response = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("DELETE_CERTIFICATE_FAILED");
      }));
      setSelectedIds([]);
      setNoticeTone("success");
      setNotice(ids.length > 1 ? `Đã xóa ${ids.length} chứng chỉ khỏi danh sách của bạn.` : "Đã xóa chứng chỉ khỏi danh sách của bạn.");
      await load();
    } catch {
      setNoticeTone("error");
      setNotice("Chưa xóa được chứng chỉ. Vui lòng tải lại trang hoặc kiểm tra quyền thao tác.");
    }
  };

  const requestDeleteCertificate = (certificate: PortalCertificate) => {
    setDeleteRequest({
      ids: [certificate.id],
      title: "Xóa chứng chỉ này?",
      description: `Chứng chỉ "${certificate.title}" sẽ bị xóa khỏi danh sách của bạn. Tín chỉ liên quan cũng sẽ được tính lại.`
    });
  };

  const requestDeleteSelected = () => {
    if (!selectedIds.length) return;
    setDeleteRequest({
      ids: selectedIds,
      title: `Xóa ${selectedIds.length} chứng chỉ đã chọn?`,
      description: "Các chứng chỉ đã chọn sẽ bị xóa khỏi danh sách của bạn. Tín chỉ liên quan cũng sẽ được tính lại."
    });
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    const ids = deleteRequest.ids;
    setDeleteRequest(null);
    await removeCertificates(ids);
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCertificate) return;
    setSaving(true);
    setNotice("");
    setNoticeTone("success");
    const form = new FormData(event.currentTarget);
    const patch = {
      title: String(form.get("title") ?? ""),
      certificateNumber: String(form.get("certificateNumber") ?? ""),
      issuer: String(form.get("issuer") ?? ""),
      issuedDate: String(form.get("issuedDate") ?? ""),
      type: String(form.get("type") ?? ""),
      hours: Number(form.get("hours") ?? 0),
      fileUrl: editingCertificate.fileUrl,
      thumbnail: editingCertificate.thumbnail,
      confidence: editingCertificate.confidence ?? 0.9
    };
    try {
      const response = await fetch(`/api/certificates/${editingCertificate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error("UPDATE_FAILED");
      setEditingCertificate(null);
      setNoticeTone("success");
      setNotice("Đã cập nhật chứng chỉ và tính lại tín chỉ.");
      await load();
    } catch {
      setNoticeTone("error");
      setNotice("Chưa cập nhật được chứng chỉ. Kiểm tra dữ liệu hoặc quyền chỉnh sửa.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = <K extends keyof UploadDraft>(key: K, value: UploadDraft[K]) => {
    setUploadDraft((current) => ({ ...current, [key]: value }));
  };

  const openUpload = () => {
    setUploadDraft(initialDraft);
    setUploadedEvidence(null);
    setOcrProcessing(false);
    setOcrMessage("");
    setUploadStep(1);
    setUploadOpen(true);
    setNotice("");
    setNoticeTone("success");
    setUploadError("");
  };

  const handleEvidenceFile = async (file: File | null) => {
    updateDraft("file", file);
    setUploadedEvidence(null);
    setOcrMessage("");
    setUploadError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      updateDraft("file", null);
      setOcrMessage("File chứng chỉ chỉ hỗ trợ PDF, JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      updateDraft("file", null);
      setOcrMessage("File chứng chỉ không được vượt quá 10MB.");
      return;
    }

    setOcrProcessing(true);
    try {
      let storedFile: UploadedEvidence | undefined;
      const formData = new FormData();
      formData.append("files", file);
      try {
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.clone().json().catch(() => null) as { files?: UploadedEvidence[] } | null;
        if (!uploadResponse.ok) {
          throw new Error(await readApiError(uploadResponse, "UPLOAD_FAILED"));
        }
        storedFile = uploadPayload?.files?.[0] ?? undefined;
        setUploadError("");
      } catch (error) {
        storedFile = undefined;
        const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
        setUploadError(message);
        setOcrMessage(`Tải tệp thất bại: ${message}. Hệ thống sẽ vẫn đọc OCR từ dữ liệu tạm.`);
      }
      setUploadedEvidence(storedFile ?? null);

      const ocrResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileUrl: storedFile?.url ?? null })
      });
      const ocrPayload = await ocrResponse.clone().json().catch(() => null) as { extracted?: unknown } | null;
      if (!ocrResponse.ok || !ocrPayload?.extracted) {
        throw new Error(await readApiError(ocrResponse, "OCR_FAILED"));
      }
      const extracted = ocrPayload.extracted as {
        certificateNumber?: string | null;
        certificateTitle?: string | null;
        holderName?: string | null;
        holderBirthDate?: string | null;
        issuingOrganization?: string | null;
        issuedDate?: string | null;
        certificateType?: string | null;
        creditHours?: number | null;
        courseContent?: string | null;
        confidence?: number | null;
      };
      const hasReadableData = Boolean(
        extracted.holderName ||
        extracted.issuedDate ||
        extracted.certificateNumber ||
        extracted.issuingOrganization ||
        (typeof extracted.creditHours === "number" && extracted.creditHours > 0)
      );
      if (!hasReadableData || (typeof extracted.confidence === "number" && extracted.confidence < 0.3)) {
        throw new Error("OCR_LOW_CONFIDENCE");
      }

      setUploadDraft((current) => ({
        ...current,
        file,
        certificateNumber: extracted.certificateNumber || current.certificateNumber,
        holderName: extracted.holderName || current.holderName,
        holderBirthDate: extracted.holderBirthDate || current.holderBirthDate,
        title: extracted.certificateTitle || current.title,
        issuer: extracted.issuingOrganization || current.issuer,
        issuedDate: extracted.issuedDate || current.issuedDate,
        type: extracted.certificateType || current.type,
        hours: typeof extracted.creditHours === "number" && extracted.creditHours > 0 ? String(extracted.creditHours) : current.hours,
        courseContent: extracted.courseContent || current.courseContent
      }));
      setOcrMessage("Đã đọc thông tin từ ảnh. Bạn kiểm tra lại ở bước tiếp theo trước khi lưu.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR_FAILED";
      if (message !== "OCR_LOW_CONFIDENCE") {
        setUploadError((current) => current || message);
      }
      setOcrMessage(message === "OCR_LOW_CONFIDENCE"
        ? "OCR đọc được nhưng độ tin cậy thấp. Bạn có thể nhập tay hoặc thử file rõ hơn."
        : `Chưa đọc được thông tin từ ảnh này: ${message}`);
    } finally {
      setOcrProcessing(false);
    }
  };

  const nextUploadStep = () => {
    if (uploadStep === 2) {
      setUploadDraft((current) => ({
        ...current,
        title: current.title || current.internalActivity || current.description || "Chứng chỉ CME/CPD",
        issuedDate: current.issuedDate || current.activityDate,
        issuer: current.issuer || (current.sourceType === "internal_training" ? overview?.employee.department ?? "" : ""),
        type: current.type || sourceTypeLabel(current.sourceType),
        courseContent: current.courseContent || current.description || current.reflection
      }));
    }
    setUploadStep((step) => Math.min(step + 1, 4));
  };

  const submitUpload = async () => {
    setSaving(true);
    setNotice("");
    setNoticeTone("success");
    let uploaded: { url?: string; thumbnailUrl?: string } | null = null;

    try {
      if (uploadedEvidence) {
        uploaded = { url: uploadedEvidence.url, thumbnailUrl: uploadedEvidence.thumbnailUrl };
      }

      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadDraft.title || "Chứng chỉ CME/CPD",
          certificateNumber: uploadDraft.certificateNumber || null,
          holderName: uploadDraft.holderName || null,
          holderBirthDate: uploadDraft.holderBirthDate || null,
          type: uploadDraft.type || sourceTypeLabel(uploadDraft.sourceType),
          issuer: uploadDraft.issuer || null,
          issuedDate: uploadDraft.issuedDate || uploadDraft.activityDate || null,
          hours: Number(uploadDraft.hours || 0),
          courseContent: buildCourseContent(uploadDraft),
          status: "",
          confidence: 0.9,
          fileUrl: uploaded?.url ?? null,
          thumbnail: uploaded?.thumbnailUrl ?? uploaded?.url ?? null
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
        throw new Error(payload?.detail || payload?.error || "CREATE_FAILED");
      }
      setUploadOpen(false);
      setUploadDraft(initialDraft);
      setUploadedEvidence(null);
      setOcrMessage("");
      setUploadStep(1);
      setNoticeTone("success");
      setNotice(uploadError
        ? `Đã lưu chứng chỉ, nhưng tệp đính kèm chưa được lưu: ${uploadError}`
        : "Đã lưu chứng chỉ. Hệ thống đã tự kiểm tra theo chu kỳ và cập nhật tín chỉ nếu được tính.");
      await load();
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Chưa lưu được chứng chỉ vào database. Vui lòng kiểm tra kết nối hệ thống rồi thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        <div className="flex flex-wrap items-center gap-3">
          <span>{loadError || "Không tải được danh sách chứng chỉ cá nhân."}</span>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />Tải lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Portal cá nhân"
        title="Chứng chỉ của tôi"
        description="Tự cập nhật chứng chỉ CME/CPD và theo dõi tín chỉ được tính trong chu kỳ 5 năm."
        actions={<Button onClick={openUpload}><Plus className="h-4 w-4" />Cập nhật chứng chỉ</Button>}
      />

      {notice ? (
        <div className={cn("mb-4 rounded-2xl border p-4 text-sm font-semibold", noticeTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
          {notice}
        </div>
      ) : null}

      <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {certificateTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition",
                  activeTab === tab.key ? "border-teal-600 bg-teal-600 text-white shadow-sm" : "border-[#D7ECE8] bg-white text-slate-700 hover:bg-teal-50"
                )}
              >
                {tab.label}
                <span className={cn("rounded-full px-2 py-0.5 text-xs", activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
        <CardContent className="grid gap-3 p-4 xl:grid-cols-[1fr_180px_150px_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Tìm theo tên chứng chỉ, mã, đơn vị cấp..." />
          </div>
          <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="Loại hoạt động" options={activityTypes} />
          <FilterSelect value={yearFilter} onChange={setYearFilter} placeholder="Năm cấp" options={issueYears} />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Trạng thái"
            options={portalStatusOptions.map((item) => item.value)}
            labels={Object.fromEntries(portalStatusOptions.map((item) => [item.value, item.label]))}
          />
          <div className="flex h-10 rounded-xl border border-[#D7ECE8] bg-white p-1">
            <ViewButton active={viewMode === "grid"} label="Grid" onClick={() => setViewMode("grid")}><Grid2X2 className="h-4 w-4" /></ViewButton>
            <ViewButton active={viewMode === "list"} label="List" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></ViewButton>
            <ViewButton active={viewMode === "kanban"} label="Kanban" onClick={() => setViewMode("kanban")}><Columns3 className="h-4 w-4" /></ViewButton>
          </div>
        </CardContent>
      </Card>

      {viewMode === "list" ? (
        <CertificateList
          certificates={paged}
          selectedIds={selectedIds}
          onToggle={(id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onToggleAll={() => {
            const ids = paged.map((certificate) => certificate.id);
            const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
            setSelectedIds(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])));
          }}
          onDetail={setSelectedCertificate}
          onEdit={setEditingCertificate}
          onDelete={requestDeleteCertificate}
        />
      ) : null}

      {viewMode === "grid" ? (
        <CertificateGrid
          certificates={paged}
          selectedIds={selectedIds}
          onToggle={(id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onDetail={setSelectedCertificate}
          onEdit={setEditingCertificate}
          onDelete={requestDeleteCertificate}
        />
      ) : null}

      {viewMode === "kanban" ? (
        <CertificateKanban
          certificates={paged}
          selectedIds={selectedIds}
          onToggle={(id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
          onDetail={setSelectedCertificate}
          onEdit={setEditingCertificate}
          onDelete={requestDeleteCertificate}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#D7ECE8] bg-white p-4 text-sm shadow-sm">
        <div className="font-semibold text-slate-700">
          {selectedIds.length ? `Đã chọn ${selectedIds.length} chứng chỉ` : `Hiển thị ${filtered.length ? pageStart + 1 : 0}-${pageEnd} / ${filtered.length} chứng chỉ`}
        </div>
        <div className="flex flex-wrap gap-2">
          <PaginationControls page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
          <Button type="button" variant="secondary" onClick={exportSelected} disabled={!filtered.length}>
            <Download className="h-4 w-4" />Export {selectedIds.length ? "đã chọn" : "danh sách"}
          </Button>
          <Button type="button" variant="destructive" onClick={requestDeleteSelected} disabled={!selectedIds.length}>
            <Trash2 className="h-4 w-4" />Xóa đã chọn
          </Button>
        </div>
      </div>

      {!filtered.length ? (
        <Card className="mt-5 rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-700">
              <FileText className="h-8 w-8" />
            </div>
            <div className="mt-4 text-lg font-bold text-slate-950">Bạn chưa có chứng chỉ nào trong nhóm này.</div>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Tải minh chứng CME/CPD để hệ thống tự kiểm tra theo chu kỳ và cập nhật tín chỉ khi đủ điều kiện.</p>
            <Button className="mt-5" onClick={openUpload}><Plus className="h-4 w-4" />Cập nhật chứng chỉ đầu tiên</Button>
          </CardContent>
        </Card>
      ) : null}

      <CertificateDetailDrawer
        certificate={selectedCertificate}
        onClose={() => setSelectedCertificate(null)}
        onEdit={(certificate) => {
          setSelectedCertificate(null);
          setEditingCertificate(certificate);
        }}
      />
      <CertificateEditDrawer certificate={editingCertificate} saving={saving} onClose={() => setEditingCertificate(null)} onSubmit={saveEdit} />
      <DeleteConfirmDialog request={deleteRequest} onCancel={() => setDeleteRequest(null)} onConfirm={() => void confirmDelete()} />
      <UploadWizardDrawer
        open={uploadOpen}
        step={uploadStep}
        draft={uploadDraft}
        employeeName={overview.employee.name}
        saving={saving}
        ocrProcessing={ocrProcessing}
        ocrMessage={ocrMessage}
        onClose={() => setUploadOpen(false)}
        onBack={() => setUploadStep((step) => Math.max(step - 1, 1))}
        onNext={nextUploadStep}
        onSubmit={submitUpload}
        onUpdate={updateDraft}
        onFileSelected={(file) => void handleEvidenceFile(file)}
        cycleLabel={overview.compliance.cycleLabel}
      />
    </>
  );
}

function CertificateList({
  certificates,
  selectedIds,
  onToggle,
  onToggleAll,
  onDetail,
  onEdit,
  onDelete
}: {
  certificates: PortalCertificate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onDetail: (certificate: PortalCertificate) => void;
  onEdit: (certificate: PortalCertificate) => void;
  onDelete: (certificate: PortalCertificate) => void;
}) {
  const allChecked = certificates.length > 0 && certificates.every((certificate) => selectedIds.includes(certificate.id));

  return (
    <Card className="mt-5 overflow-hidden rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-[#F5FBFA] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 p-4">
                <input type="checkbox" checked={allChecked} onChange={onToggleAll} aria-label="Chọn tất cả chứng chỉ" className="h-4 w-4 rounded border-teal-300 accent-teal-600" />
              </th>
              <th className="px-4 py-4">Chứng chỉ</th>
              <th className="px-4 py-4">Đơn vị cấp</th>
              <th className="px-4 py-4">Ngày cấp</th>
              <th className="px-4 py-4">Loại hoạt động</th>
              <th className="px-4 py-4">Tín chỉ</th>
              <th className="px-4 py-4">Trạng thái</th>
              <th className="px-4 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D7ECE8] bg-white">
            {certificates.map((certificate) => {
              const status = normalizeCertificateStatus(certificate);
              return (
                <tr key={certificate.id} className="hover:bg-teal-50/40">
                  <td className="p-4">
                    <input type="checkbox" checked={selectedIds.includes(certificate.id)} onChange={() => onToggle(certificate.id)} aria-label={`Chọn ${certificate.title}`} className="h-4 w-4 rounded border-teal-300 accent-teal-600" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">{certificate.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{certificate.code || certificate.certificateNumber || "Chưa có mã"}</div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{certificate.issuer || "Chưa cập nhật"}</td>
                  <td className="px-4 py-4">{formatDate(certificate.issuedDate)}</td>
                  <td className="px-4 py-4">{certificate.type || "CME/CPD"}</td>
                  <td className="px-4 py-4 font-semibold">{getProposedCredits(certificate)} đề nghị · {getRecognizedCredits(certificate, status)} ghi nhận</td>
                  <td className="px-4 py-4"><CertificateStatusBadge status={status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" disabled={!certificate.fileUrl} aria-label="Xem file">
                        <a href={certificate.fileUrl ?? "#"} target={certificate.fileUrl ? "_blank" : undefined} rel="noreferrer"><Eye className="h-4 w-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDetail(certificate)} aria-label="Chi tiết"><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(certificate)} aria-label="Sửa"><Edit3 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(certificate)} aria-label="Xóa"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CertificateGrid({
  certificates,
  selectedIds,
  onToggle,
  onDetail,
  onEdit,
  onDelete
}: {
  certificates: PortalCertificate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDetail: (certificate: PortalCertificate) => void;
  onEdit: (certificate: PortalCertificate) => void;
  onDelete: (certificate: PortalCertificate) => void;
}) {
  return (
    <section className="mt-5 grid gap-4 xl:grid-cols-2">
      {certificates.map((certificate) => {
        const status = normalizeCertificateStatus(certificate);
        return (
          <Card key={certificate.id} className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <label className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7ECE8] bg-white">
                  <input type="checkbox" checked={selectedIds.includes(certificate.id)} onChange={() => onToggle(certificate.id)} aria-label={`Chọn ${certificate.title}`} className="h-4 w-4 rounded border-teal-300 accent-teal-600" />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-base font-bold text-slate-950">{certificate.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{certificate.code || certificate.certificateNumber || "Chưa có mã chứng chỉ"}</p>
                    </div>
                    <CertificateStatusBadge status={status} />
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <DetailMini label="Đơn vị cấp" value={certificate.issuer || "Chưa cập nhật"} />
                    <DetailMini label="Ngày cấp" value={formatDate(certificate.issuedDate)} />
                    <DetailMini label="Loại hoạt động" value={certificate.type || "CME/CPD"} />
                    <DetailMini label="Tín chỉ" value={`${getProposedCredits(certificate)} đề nghị · ${getRecognizedCredits(certificate, status)} ghi nhận`} />
                  </div>
                  <div className="mt-4 rounded-2xl bg-[#F5FBFA] p-3 text-sm leading-6 text-slate-600">{certificateProcessNote(certificate, status)}</div>
                  <RowActions certificate={certificate} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function CertificateKanban({
  certificates,
  selectedIds,
  onToggle,
  onDetail,
  onEdit,
  onDelete
}: {
  certificates: PortalCertificate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDetail: (certificate: PortalCertificate) => void;
  onEdit: (certificate: PortalCertificate) => void;
  onDelete: (certificate: PortalCertificate) => void;
}) {
  const columns: Array<{ status: PortalCertificateStatus; label: string }> = [
    { status: "counted", label: "Được tính" },
    { status: "out_of_cycle", label: "Không tính" },
    { status: "needs_info", label: "Cần nhập thêm" },
    { status: "duplicate_suspected", label: "Nghi trùng lặp" }
  ];

  return (
    <div className="mt-5 flex gap-4 overflow-x-auto pb-3">
      {columns.map((column) => {
        const rows = certificates.filter((certificate) => normalizeCertificateStatus(certificate) === column.status || (column.status === "out_of_cycle" && normalizeCertificateStatus(certificate) === "not_counted"));
        return (
          <div key={column.status} className="min-h-96 w-80 flex-none rounded-[24px] border border-[#D7ECE8] bg-[#F5FBFA] p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="font-bold text-slate-900">{column.label}</div>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{rows.length}</span>
            </div>
            <div className="space-y-3">
              {rows.map((certificate) => {
                const status = normalizeCertificateStatus(certificate);
                return (
                  <Card key={certificate.id} className="rounded-2xl border-[#D7ECE8] bg-white shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selectedIds.includes(certificate.id)} onChange={() => onToggle(certificate.id)} aria-label={`Chọn ${certificate.title}`} className="mt-1 h-4 w-4 rounded border-teal-300 accent-teal-600" />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 font-bold text-slate-950">{certificate.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{certificate.code || certificate.certificateNumber || "Chưa có mã"}</div>
                          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                            <span>{formatDate(certificate.issuedDate)}</span>
                            <span className="font-semibold">{getRecognizedCredits(certificate, status)} tín chỉ</span>
                          </div>
                        </div>
                      </div>
                      <RowActions certificate={certificate} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete} compact />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RowActions({
  certificate,
  onDetail,
  onEdit,
  onDelete,
  compact = false
}: {
  certificate: PortalCertificate;
  onDetail: (certificate: PortalCertificate) => void;
  onEdit: (certificate: PortalCertificate) => void;
  onDelete: (certificate: PortalCertificate) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-3" : "mt-4")}>
      <Button asChild size={compact ? "icon" : "sm"} variant="secondary" disabled={!certificate.fileUrl} aria-label="Xem file">
        <a href={certificate.fileUrl ?? "#"} target={certificate.fileUrl ? "_blank" : undefined} rel="noreferrer">
          <Eye className="h-4 w-4" />{compact ? null : "Xem file"}
        </a>
      </Button>
      <Button size={compact ? "icon" : "sm"} variant="secondary" onClick={() => onDetail(certificate)} aria-label="Chi tiết"><FileText className="h-4 w-4" />{compact ? null : "Chi tiết"}</Button>
      <Button size={compact ? "icon" : "sm"} variant="secondary" onClick={() => onEdit(certificate)} aria-label="Sửa"><Edit3 className="h-4 w-4" />{compact ? null : "Sửa"}</Button>
      <Button size={compact ? "icon" : "sm"} variant="secondary" onClick={() => onDelete(certificate)} aria-label="Xóa"><Trash2 className="h-4 w-4" />{compact ? null : "Xóa"}</Button>
    </div>
  );
}

function DeleteConfirmDialog({
  request,
  onCancel,
  onConfirm
}: {
  request: DeleteRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={onCancel} aria-label="Hủy xóa chứng chỉ" />
      <div className="relative w-full max-w-md rounded-[24px] border border-red-100 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-950">{request.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{request.description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4" />Xác nhận xóa
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("flex h-8 w-9 items-center justify-center rounded-lg transition", active ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-teal-50")}>
      {children}
    </button>
  );
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
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-10 rounded-xl border border-[#D7ECE8] bg-white px-2 text-sm">
        {[5, 10, 20, 50].map((value) => <option key={value} value={value}>{value}/trang</option>)}
      </select>
      <span className="min-w-12 text-center text-sm font-semibold text-slate-600">{page}/{totalPages}</span>
      <Button type="button" variant="secondary" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Trang trước">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button type="button" variant="secondary" size="icon" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Trang sau">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CertificateEditDrawer({
  certificate,
  saving,
  onClose,
  onSubmit
}: {
  certificate: PortalCertificate | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (!certificate) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={onClose} aria-label="Đóng chỉnh sửa" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D7ECE8] p-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-teal-700">Sửa chứng chỉ</div>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{certificate.title}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên chứng chỉ"><Input name="title" defaultValue={certificate.title} required /></Field>
            <Field label="Mã chứng chỉ"><Input name="certificateNumber" defaultValue={certificate.certificateNumber || certificate.code || ""} /></Field>
            <Field label="Đơn vị cấp"><Input name="issuer" defaultValue={certificate.issuer || ""} required /></Field>
            <Field label="Ngày cấp từ ảnh chứng chỉ">
              <Input name="issuedDate" type="date" defaultValue={certificate.issuedDate || ""} readOnly className="bg-slate-50 text-slate-500" required />
            </Field>
            <Field label="Loại hoạt động"><Input name="type" defaultValue={certificate.type || "CME/CPD"} /></Field>
            <Field label="Tín chỉ"><Input name="hours" type="number" min="0" step="0.5" defaultValue={certificate.hours || 0} required /></Field>
          </div>
          <div className="mt-5 rounded-2xl bg-[#F5FBFA] p-4 text-sm leading-6 text-slate-600">
            Ngày cấp được lấy từ OCR trên ảnh chứng chỉ. Nhân viên không chỉnh ngày cấp tại portal; nếu OCR sai, admin có thể hiệu chỉnh trong kho chứng chỉ.
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Lưu & cập nhật tín chỉ</Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function CertificateDetailDrawer({
  certificate,
  onClose,
  onEdit
}: {
  certificate: PortalCertificate | null;
  onClose: () => void;
  onEdit: (certificate: PortalCertificate) => void;
}) {
  if (!certificate) return null;
  const status = normalizeCertificateStatus(certificate);
  const timeline = certificateTimeline(status, certificate);
  const processNote = certificateProcessNote(certificate, status);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={onClose} aria-label="Đóng chi tiết" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D7ECE8] p-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-teal-700">Chi tiết chứng chỉ</div>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{certificate.title}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex min-h-52 items-center justify-center overflow-hidden rounded-[24px] border border-[#D7ECE8] bg-[#F5FBFA]">
            {certificate.thumbnail && !certificate.thumbnail.endsWith(".pdf") ? (
              <Image src={certificate.thumbnail} alt={certificate.title} width={520} height={288} unoptimized className="max-h-72 w-full object-contain" />
            ) : (
              <div className="text-center text-teal-700">
                <FileText className="mx-auto h-12 w-12" />
                <div className="mt-2 text-sm font-semibold">Tệp minh chứng</div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailItem label="Mã chứng chỉ" value={certificate.code || certificate.certificateNumber || "Chưa cập nhật"} />
            <DetailItem label="Đơn vị cấp" value={certificate.issuer || "Chưa cập nhật"} />
            <DetailItem label="Ngày cấp" value={formatDate(certificate.issuedDate)} />
            <DetailItem label="Loại hoạt động" value={certificate.type || "CME/CPD"} />
            <DetailItem label="Tín chỉ đề nghị" value={`${getProposedCredits(certificate)} tín chỉ`} />
            <DetailItem label="Tín chỉ được ghi nhận" value={`${getRecognizedCredits(certificate, status)} tín chỉ`} />
          </div>

          <div className="mt-5 rounded-[24px] border border-[#D7ECE8] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-500">Trạng thái</div>
              <CertificateStatusBadge status={status} />
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">{processNote}</div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#D7ECE8] p-4">
            <h3 className="font-bold text-slate-950">Tiến trình xử lý</h3>
            <div className="mt-4 space-y-4">
              {timeline.map((item, index) => (
                <div key={item.label} className="flex gap-3">
                  <div className={cn("mt-1 h-3 w-3 rounded-full", index === timeline.length - 1 ? "bg-teal-600" : "bg-emerald-500")} />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="text-sm text-slate-500">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#D7ECE8] p-4">
            <h3 className="font-bold text-slate-950">Tệp đính kèm</h3>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-teal-700" />
                <span className="truncate">{certificate.fileName || certificate.fileUrl || "Chưa có tệp"}</span>
              </div>
              {certificate.fileUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={certificate.fileUrl} download><Download className="h-4 w-4" />Tải</a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[#D7ECE8] p-5">
          <div className="flex flex-wrap justify-end gap-2">
            {certificate.fileUrl ? (
              <Button asChild variant="secondary">
                <a href={certificate.fileUrl} download><Download className="h-4 w-4" />Download file</a>
              </Button>
            ) : null}
            {status === "needs_info" ? <Button onClick={() => onEdit(certificate)}><RefreshCw className="h-4 w-4" />Nhập thêm thông tin</Button> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function UploadWizardDrawer({
  open,
  step,
  draft,
  employeeName,
  saving,
  ocrProcessing,
  ocrMessage,
  onClose,
  onBack,
  onNext,
  onSubmit,
  onUpdate,
  onFileSelected,
  cycleLabel
}: {
  open: boolean;
  step: number;
  draft: UploadDraft;
  employeeName: string;
  saving: boolean;
  ocrProcessing: boolean;
  ocrMessage: string;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof UploadDraft>(key: K, value: UploadDraft[K]) => void;
  onFileSelected: (file: File | null) => void;
  cycleLabel: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={onClose} aria-label="Đóng tải chứng chỉ" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="border-b border-[#D7ECE8] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-teal-700">Tự động tính tín chỉ</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Cập nhật chứng chỉ CME/CPD</h2>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className={cn("h-2 rounded-full", item <= step ? "bg-teal-600" : "bg-slate-100")} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 ? <UploadStepEvidence draft={draft} ocrProcessing={ocrProcessing} ocrMessage={ocrMessage} onUpdate={onUpdate} onFileSelected={onFileSelected} /> : null}
          {step === 2 ? <UploadStepReview draft={draft} onUpdate={onUpdate} /> : null}
          {step === 3 ? <UploadStepConfirm draft={draft} cycleLabel={cycleLabel} employeeName={employeeName} /> : null}
          {step === 4 ? <UploadStepFinal draft={draft} cycleLabel={cycleLabel} employeeName={employeeName} /> : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#D7ECE8] p-5">
          <Button variant="secondary" onClick={step === 1 ? onClose : onBack}>
            <ChevronLeft className="h-4 w-4" />{step === 1 ? "Hủy" : "Quay lại"}
          </Button>
          {step < 4 ? (
            <Button onClick={onNext} disabled={step === 2 && ocrProcessing}>Tiếp tục<ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Lưu & cập nhật tín chỉ
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function UploadStepEvidence({
  draft,
  ocrProcessing,
  ocrMessage,
  onUpdate,
  onFileSelected
}: {
  draft: UploadDraft;
  ocrProcessing: boolean;
  ocrMessage: string;
  onUpdate: <K extends keyof UploadDraft>(key: K, value: UploadDraft[K]) => void;
  onFileSelected: (file: File | null) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-bold text-slate-950">1. Tải file chứng chỉ</h3>
      <p className="mt-1 text-sm text-slate-500">Tải file chứng chỉ. Hệ thống sẽ tự đọc dữ liệu, ngày cấp được lấy theo nội dung trên ảnh/PDF.</p>

      <div className="mt-5 grid gap-4">
        {draft.sourceType === "internal_training" ? (
          <Field label="Hoạt động đào tạo đã hoàn thành">
            <select value={draft.internalActivity} onChange={(event) => onUpdate("internalActivity", event.target.value)} className="h-10 w-full rounded-xl border bg-white px-3 text-sm">
              <option value="">Chọn hoạt động</option>
              <option>Cập nhật cấp cứu ban đầu</option>
              <option>Kiểm soát nhiễm khuẩn nội bộ</option>
              <option>An toàn người bệnh</option>
            </select>
          </Field>
        ) : null}

        {draft.sourceType === "self_learning" ? (
          <>
            <Field label="Tiêu đề nội dung học"><Input value={draft.title} onChange={(event) => onUpdate("title", event.target.value)} placeholder="Tên khóa học / chủ đề tự học" /></Field>
            <Field label="Link học tập"><Input value={draft.learningLink} onChange={(event) => onUpdate("learningLink", event.target.value)} placeholder="https://..." /></Field>
            <Field label="Số giờ học"><Input value={draft.hours} onChange={(event) => onUpdate("hours", event.target.value)} type="number" min="0" step="0.5" placeholder="Ví dụ: 4" /></Field>
            <Field label="Reflection / ghi chú học tập"><textarea value={draft.reflection} onChange={(event) => onUpdate("reflection", event.target.value)} className="min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
          </>
        ) : null}

        {draft.sourceType === "professional_activity" ? (
          <>
            <Field label="Mô tả hoạt động"><textarea value={draft.description} onChange={(event) => onUpdate("description", event.target.value)} className="min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Nghiên cứu, giảng dạy, QI, hội nghị..." /></Field>
            <Field label="Ngày hoạt động"><Input value={draft.activityDate} onChange={(event) => onUpdate("activityDate", event.target.value)} type="date" /></Field>
            <Field label="Đơn vị tổ chức"><Input value={draft.issuer} onChange={(event) => onUpdate("issuer", event.target.value)} placeholder="Tên đơn vị / ban tổ chức" /></Field>
          </>
        ) : null}

        {draft.sourceType === "external_certificate" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên chứng chỉ"><Input value={draft.title} onChange={(event) => onUpdate("title", event.target.value)} placeholder="Tên chứng chỉ / khóa học" /></Field>
            <Field label="Số chứng chỉ"><Input value={draft.certificateNumber} onChange={(event) => onUpdate("certificateNumber", event.target.value)} placeholder="Mã hoặc số chứng chỉ" /></Field>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Đơn vị cấp / tổ chức"><Input value={draft.issuer} onChange={(event) => onUpdate("issuer", event.target.value)} placeholder="Đơn vị cấp" /></Field>
          <Field label="Ngày cấp từ ảnh chứng chỉ">
            <Input value={draft.issuedDate} type="date" readOnly className="bg-slate-50 text-slate-500" placeholder="Tự đọc sau khi upload file" />
          </Field>
          <Field label="Loại hoạt động"><Input value={draft.type} onChange={(event) => onUpdate("type", event.target.value)} placeholder="CME/CPD, hội nghị..." /></Field>
          <Field label="Tín chỉ đề nghị"><Input value={draft.hours} onChange={(event) => onUpdate("hours", event.target.value)} type="number" min="0" step="0.5" placeholder="Số tín chỉ" /></Field>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-teal-300 bg-teal-50 p-6 text-center text-sm font-semibold text-teal-800">
          <Upload className="h-7 w-7" />
          <span className="mt-2">{draft.file ? draft.file.name : "Tải PDF/JPG/PNG hoặc chụp ảnh minh chứng"}</span>
          <span className="mt-1 text-xs font-medium text-teal-700">Sau khi chọn file, hệ thống sẽ tự đọc tên chứng chỉ, đơn vị cấp, ngày cấp và tín chỉ đề nghị.</span>
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)} />
        </label>

        {ocrProcessing || ocrMessage ? (
          <div className={cn("rounded-2xl border p-4 text-sm font-semibold", ocrProcessing ? "border-blue-200 bg-blue-50 text-blue-800" : ocrMessage.startsWith("Đã") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")}>
            <div className="flex items-center gap-2">
              {ocrProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              {ocrProcessing ? "Đang đọc thông tin từ ảnh..." : ocrMessage}
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}

function UploadStepReview({ draft, onUpdate }: { draft: UploadDraft; onUpdate: <K extends keyof UploadDraft>(key: K, value: UploadDraft[K]) => void }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-slate-950">2. Kiểm tra dữ liệu hệ thống đã đọc</h3>
      <p className="mt-1 text-sm text-slate-500">Bạn có thể sửa các trường mô tả. Ngày cấp được khóa theo dữ liệu OCR từ ảnh/PDF.</p>
      <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Hệ thống đã tạo bản nháp thông tin từ minh chứng và dữ liệu bạn nhập. Không có bước xử lý thủ công.
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Tên chứng chỉ"><Input value={draft.title} onChange={(event) => onUpdate("title", event.target.value)} /></Field>
        <Field label="Đơn vị cấp"><Input value={draft.issuer} onChange={(event) => onUpdate("issuer", event.target.value)} /></Field>
        <Field label="Ngày cấp từ ảnh chứng chỉ"><Input value={draft.issuedDate} type="date" readOnly className="bg-slate-50 text-slate-500" /></Field>
        <Field label="Người trên chứng chỉ"><Input value={draft.holderName || "Chưa đọc được"} readOnly className="bg-slate-50 text-slate-500" /></Field>
        <Field label="Ngày sinh trên chứng chỉ"><Input value={draft.holderBirthDate || "Chưa đọc được"} readOnly className="bg-slate-50 text-slate-500" /></Field>
        <Field label="Số chứng chỉ"><Input value={draft.certificateNumber} onChange={(event) => onUpdate("certificateNumber", event.target.value)} /></Field>
        <Field label="Tín chỉ đề nghị"><Input value={draft.hours} onChange={(event) => onUpdate("hours", event.target.value)} type="number" min="0" step="0.5" /></Field>
        <Field label="Loại hoạt động"><Input value={draft.type} onChange={(event) => onUpdate("type", event.target.value)} /></Field>
      </div>
    </div>
  );
}

function UploadStepConfirm({ draft, cycleLabel, employeeName }: { draft: UploadDraft; cycleLabel: string; employeeName: string }) {
  const result = calculateDraftResult(draft, cycleLabel, employeeName);
  return (
    <div>
      <h3 className="text-lg font-bold text-slate-950">3. Kết quả tự động tính tín chỉ</h3>
      <p className="mt-1 text-sm text-slate-500">Hệ thống tự kiểm tra theo chu kỳ hiện tại trước khi lưu.</p>
      <div className="mt-5 rounded-[24px] border border-[#D7ECE8] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Chu kỳ hiện tại" value={cycleLabel || "Chưa cấu hình"} />
          <DetailItem label="Tên chứng chỉ" value={draft.title || "Chưa nhập"} />
          <DetailItem label="Đơn vị cấp" value={draft.issuer || "Chưa nhập"} />
          <DetailItem label="Người trên chứng chỉ" value={draft.holderName || "Chưa đọc được"} />
          <DetailItem label="Hồ sơ đang đăng nhập" value={employeeName || "Chưa có hồ sơ"} />
          <DetailItem label="Ngày cấp" value={draft.issuedDate ? formatDate(draft.issuedDate) : "Chưa cập nhật"} />
          <DetailItem label="Trạng thái tính" value={result.label} />
          <DetailItem label="Tín chỉ sẽ cộng" value={`${result.countedCredits} tín chỉ`} />
        </div>
      </div>
      <div className={cn("mt-5 rounded-[24px] p-4 text-sm leading-6", result.status === "counted" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
        {result.reason}
      </div>
    </div>
  );
}

function UploadStepFinal({ draft, cycleLabel, employeeName }: { draft: UploadDraft; cycleLabel: string; employeeName: string }) {
  const result = calculateDraftResult(draft, cycleLabel, employeeName);
  return (
    <div>
      <h3 className="text-lg font-bold text-slate-950">4. Lưu & cập nhật tín chỉ</h3>
      <p className="mt-1 text-sm text-slate-500">Sau khi lưu, admin dashboard và hồ sơ tín chỉ sẽ cập nhật tự động nếu chứng chỉ được tính.</p>
      <div className="mt-5 rounded-[24px] border border-[#D7ECE8] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Mã chứng chỉ" value={draft.certificateNumber || "Chưa nhập"} />
          <DetailItem label="Loại hoạt động" value={draft.type || "CME/CPD"} />
          <DetailItem label="Tín chỉ đề nghị" value={`${draft.hours || 0} tín chỉ`} />
          <DetailItem label="Tín chỉ được tính" value={`${result.countedCredits} tín chỉ`} />
          <DetailItem label="Trạng thái" value={result.label} />
          <DetailItem label="Tệp đính kèm" value={draft.file?.name || "Chưa có tệp"} />
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function FilterSelect({ value, onChange, placeholder, options, labels = {} }: { value: string; onChange: (value: string) => void; placeholder: string; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm text-slate-700">
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>{labels[option] ?? option}</option>
      ))}
    </select>
  );
}

function CertificateStatusBadge({ status }: { status: PortalCertificateStatus }) {
  const item = portalStatusLabels[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function normalizeCertificateStatus(certificate: PortalCertificate): PortalCertificateStatus {
  if (certificate.calculationStatus === "counted") return "counted";
  if (certificate.calculationStatus === "out_of_cycle") return "out_of_cycle";
  if (certificate.calculationStatus === "needs_info") return "needs_info";
  if (certificate.calculationStatus === "duplicate_suspected" || certificate.isDuplicateSuspected) return "duplicate_suspected";
  const raw = String(certificate.status ?? "").trim();
  const lower = raw.toLowerCase();
  if (certificate.includeInCycle === false || ["out_of_cycle", "excluded_from_cycle", "không tính chu kỳ", "đã hết hạn"].includes(lower)) return "out_of_cycle";
  if (["approved", "đã duyệt", "được tính", "hợp lệ", "counted"].includes(lower)) return "counted";
  if (["needs_info", "needs_more_info", "pending_confirmation", "thiếu thông tin", "cần bổ sung", "cần nhập thêm thông tin"].includes(lower)) return "needs_info";
  if (["rejected", "từ chối", "không được chấp nhận", "không tính", "not_counted"].includes(lower)) return "not_counted";
  if (["duplicate", "duplicate_suspected", "nghi trùng", "nghi trùng lặp", "có thể bị trùng"].includes(lower)) return "duplicate_suspected";
  if (["draft", "bản nháp"].includes(lower)) return "draft";
  if (["cancelled", "đã hủy", "hủy"].includes(lower)) return "cancelled";
  if (["submitted", "đã nộp"].includes(lower)) return "submitted";
  return "needs_info";
}

function certificateProcessNote(certificate: PortalCertificate, status: PortalCertificateStatus) {
  if (certificate.adminNote) return certificate.adminNote;
  if (certificate.calculationReason) return certificate.calculationReason;
  if (status === "out_of_cycle") return "Không tính vì ngày cấp nằm ngoài chu kỳ hiện tại.";
  if (status === "counted") return "Được tính vào chu kỳ cá nhân và tín chỉ đã được cộng tự động.";
  if (status === "needs_info") return "Cần nhập thêm thông tin bắt buộc trước khi hệ thống cộng tín chỉ.";
  if (status === "not_counted") return "Không tính vào tín chỉ chu kỳ hiện tại.";
  if (status === "duplicate_suspected") return "Nghi trùng lặp với chứng chỉ đã có nên tín chỉ không được cộng lần hai.";
  if (status === "draft") return "Bản nháp, chưa gửi xử lý.";
  if (status === "cancelled") return "Hồ sơ đã được hủy.";
  return "Hệ thống tự kiểm tra theo chu kỳ.";
}

function getProposedCredits(certificate: PortalCertificate) {
  return certificate.proposedCredits ?? certificate.hours ?? 0;
}

function getRecognizedCredits(certificate: PortalCertificate, status: PortalCertificateStatus) {
  if (typeof certificate.recognizedCredits === "number") return certificate.recognizedCredits;
  if (typeof certificate.countedCredits === "number") return certificate.countedCredits;
  if (status !== "counted") return 0;
  return certificate.cycleCountedHours ?? certificate.hours ?? 0;
}

function yearFromDate(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getFullYear());
}

function sourceTypeLabel(sourceType: SourceType) {
  const labels: Record<SourceType, string> = {
    external_certificate: "Chứng chỉ CME/CPD",
    internal_training: "Đào tạo nội bộ",
    self_learning: "Tự học / học trực tuyến",
    professional_activity: "Hoạt động chuyên môn khác"
  };
  return labels[sourceType];
}

function buildCourseContent(draft: UploadDraft) {
  const parts = [
    `Nguồn: ${sourceTypeLabel(draft.sourceType)}`,
    draft.holderName ? `Người trên chứng chỉ: ${draft.holderName}` : "",
    draft.holderBirthDate ? `Ngày sinh trên chứng chỉ: ${draft.holderBirthDate}` : "",
    draft.courseContent,
    draft.learningLink ? `Link học tập: ${draft.learningLink}` : "",
    draft.reflection ? `Reflection: ${draft.reflection}` : "",
    draft.description ? `Mô tả: ${draft.description}` : "",
    draft.internalActivity ? `Hoạt động nội bộ: ${draft.internalActivity}` : ""
  ].filter(Boolean);
  return parts.join("\n");
}

function calculateDraftResult(draft: UploadDraft, cycleLabel: string, employeeName?: string) {
  const credits = Number(draft.hours || 0);
  const identity = assessDraftIdentity(draft.holderName, employeeName);
  const missingRequired = !draft.title.trim() || !draft.issuer.trim() || !draft.issuedDate || !draft.certificateNumber.trim() || !credits || !draft.file || !identity.ok;
  if (missingRequired) {
    return {
      status: "needs_info",
      label: "Cần nhập thêm thông tin",
      countedCredits: 0,
      reason: identity.ok
        ? "Thiếu trường bắt buộc nên tín chỉ chưa được tính. Cần có tiêu đề, đơn vị cấp, ngày cấp, mã chứng chỉ, tín chỉ và file đính kèm."
        : identity.reason
    };
  }

  const years = cycleLabel.match(/\d{4}/g)?.map(Number) ?? [];
  const startYear = years[0];
  const endYear = years[1] ?? (startYear ? startYear + 4 : undefined);
  const issuedYear = new Date(draft.issuedDate).getFullYear();
  const inCycle = startYear && endYear ? issuedYear >= startYear && issuedYear <= endYear : true;

  if (!inCycle) {
    return {
      status: "out_of_cycle",
      label: "Không tính",
      countedCredits: 0,
      reason: `Ngày cấp ${formatDate(draft.issuedDate)} nằm ngoài chu kỳ ${cycleLabel || "hiện tại"}, nên recognizedCredits = 0.`
    };
  }

  return {
    status: "counted",
    label: "Được tính",
    countedCredits: credits,
    reason: `Ngày cấp ${formatDate(draft.issuedDate)} nằm trong chu kỳ ${cycleLabel || "hiện tại"}, nên ${credits} tín chỉ sẽ được cộng tự động.`
  };
}

function assessDraftIdentity(holderName?: string, employeeName?: string) {
  if (!employeeName?.trim()) return { ok: false, reason: "Hồ sơ nhân viên chưa có tên để đối chiếu người trên chứng chỉ." };
  if (!holderName?.trim()) return { ok: false, reason: "Chưa đọc được tên người trên chứng chỉ, nên tín chỉ chưa được tính. Vui lòng tải ảnh rõ hơn hoặc để admin kiểm tra dữ liệu OCR." };
  if (normalizePersonName(holderName) !== normalizePersonName(employeeName)) {
    return {
      ok: false,
      reason: `Người trên chứng chỉ (${holderName}) không khớp hồ sơ đang đăng nhập (${employeeName}), nên tín chỉ chưa được tính.`
    };
  }
  return { ok: true, reason: "" };
}

function normalizePersonName(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function certificateTimeline(status: PortalCertificateStatus, certificate?: PortalCertificate) {
  const base = [{ label: "Đã tải minh chứng", description: "Hồ sơ được tạo trên portal cá nhân." }];
  if (status === "draft") return [{ label: "Bản nháp", description: "Bạn chưa lưu chứng chỉ." }];
  if (status === "submitted") return [...base, { label: "Hệ thống tự kiểm tra", description: "Dữ liệu đang được xử lý tự động." }];
  if (status === "needs_info") {
    return [...base, { label: "Cần nhập thêm thông tin", description: certificate ? certificateProcessNote(certificate, status) : "Bạn cần cập nhật đủ trường bắt buộc." }];
  }
  if (status === "counted") return [...base, { label: "Được tính", description: "Tín chỉ hợp lệ đã được cộng vào chu kỳ cá nhân." }];
  if (status === "out_of_cycle") return [...base, { label: "Không được tính", description: "Minh chứng nằm ngoài chu kỳ hiện tại." }];
  if (status === "duplicate_suspected") return [...base, { label: "Nghi trùng lặp", description: "Tín chỉ không được cộng lần hai." }];
  return [...base, { label: portalStatusLabels[status].label, description: certificateStatusDescription(status) }];
}

function certificateStatusDescription(status: PortalCertificateStatus) {
  if (status === "not_counted") return "Chứng chỉ không đáp ứng điều kiện tính tín chỉ.";
  if (status === "cancelled") return "Hồ sơ đã được hủy.";
  return "Hệ thống tự kiểm tra theo chu kỳ.";
}

const certificateTabs: Array<{ key: TabKey; label: string }> = [
  { key: "counted", label: "Được tính" },
  { key: "out_of_cycle", label: "Không tính" },
  { key: "needs_info", label: "Cần nhập thêm" },
  { key: "duplicate_suspected", label: "Nghi trùng lặp" },
  { key: "all", label: "Tất cả" }
];

const portalStatusLabels: Record<PortalCertificateStatus, { label: string; tone: "green" | "yellow" | "red" | "gray" | "blue" }> = {
  draft: { label: "Bản nháp", tone: "gray" },
  submitted: { label: "Đã nộp", tone: "blue" },
  needs_info: { label: "Cần nhập thêm thông tin", tone: "blue" },
  counted: { label: "Được tính", tone: "green" },
  not_counted: { label: "Không tính", tone: "red" },
  out_of_cycle: { label: "Không tính", tone: "gray" },
  duplicate_suspected: { label: "Nghi trùng lặp", tone: "yellow" },
  cancelled: { label: "Đã hủy", tone: "gray" }
};

const portalStatusOptions: Array<{ value: PortalCertificateStatus; label: string }> = [
  { value: "counted", label: "Được tính" },
  { value: "out_of_cycle", label: "Không tính" },
  { value: "needs_info", label: "Cần nhập thêm thông tin" },
  { value: "duplicate_suspected", label: "Nghi trùng lặp" },
  { value: "draft", label: "Bản nháp" }
];
