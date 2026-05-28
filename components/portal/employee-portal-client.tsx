"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { AlertCircle, ArrowRight, Award, BarChart3, BriefcaseBusiness, Building2, CalendarClock, CheckCircle2, ClipboardList, Download, FileClock, FileText, FileUp, GraduationCap, Loader2, Mail, ShieldCheck, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { PortalOverview } from "@/components/portal/portal-types";

export function EmployeePortalClient() {
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      setError("");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch("/api/portal/overview", { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data) {
          setOverview(null);
          setError(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : "Không tải được dữ liệu portal cá nhân từ database.");
          return;
        }
        setOverview(payload.data);
      } catch {
        setOverview(null);
        setError("Không kết nối được API portal cá nhân. Vui lòng tải lại trang.");
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    }

    void loadOverview();
  }, []);

  const yearRows = useMemo(() => {
    if (!overview) return [];
    const [startText, endText] = overview.compliance.cycleLabel.split("-").map((item) => Number(item.trim()));
    const startYear = Number.isFinite(startText) ? startText : new Date().getFullYear();
    const endYear = Number.isFinite(endText) ? endText : startYear + 4;
    const cycleYears = Math.max(1, endYear - startYear);
    const annualTarget = Math.ceil(overview.compliance.requiredHours / cycleYears);
    return Array.from({ length: Math.max(1, endYear - startYear) }, (_, index) => {
      const year = startYear + index;
      return {
        year,
        hours: overview.compliance.yearlyHours[String(year)] ?? 0,
        target: annualTarget
      };
    });
  }, [overview]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        {error || "Không tải được dữ liệu portal cá nhân."}
        <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>Tải lại trang</Button>
      </div>
    );
  }

  const employee = overview.employee;
  const compliance = overview.compliance;
  const recentCertificates = overview.certificates.slice(0, 4);
  const remainingDays = compliance.daysRemaining === null ? "Chưa cấu hình" : `${compliance.daysRemaining} ngày`;
  const missingLicenseDate = !employee.licenseIssuedAt;
  const annualTarget = yearRows[0]?.target ?? Math.ceil(compliance.requiredHours / 5);
  const guidance = compliance.missingHours > 0
    ? `Bạn còn thiếu ${compliance.missingHours} tín chỉ trong chu kỳ hiện tại. Ưu tiên cập nhật các chứng chỉ đã hoàn thành hoặc đăng ký hoạt động phù hợp trước hạn.`
    : "Bạn đã đạt yêu cầu tín chỉ trong chu kỳ hiện tại. Tiếp tục cập nhật chứng chỉ mới để hồ sơ luôn đầy đủ.";

  const exportPersonalReport = () => {
    downloadCsv("bao-cao-cpd-ca-nhan.csv", [
      {
        employee: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        licenseNumber: employee.licenseNumber,
        cycle: compliance.cycleLabel,
        approvedHours: compliance.approvedHours,
        requiredHours: compliance.requiredHours,
        missingHours: compliance.missingHours,
        completionRate: `${compliance.completionRate}%`,
        pendingCertificates: overview.counts.pending,
        totalCertificates: overview.counts.total
      },
      ...overview.certificates.map((certificate) => ({
        employee: employee.name,
        email: employee.email,
        certificate: certificate.title,
        issuer: certificate.issuer,
        issuedDate: certificate.issuedDate,
        proposedCredits: certificate.hours,
        status: certificate.status
      }))
    ]);
  };

  return (
    <div className="space-y-6">
      {missingLicenseDate ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold">Cần cập nhật ngày cấp CCHN/GPLH</div>
            <div className="mt-1 leading-6">Hệ thống cần ngày này để xác định chu kỳ CPD 5 năm. Khi chưa có, chứng chỉ mới sẽ chưa được cộng tín chỉ tự động.</div>
          </div>
          <Button asChild variant="secondary" className="ml-auto shrink-0">
            <Link href="/portal/profile">Cập nhật</Link>
          </Button>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[24px] border border-[#D7ECE8] bg-gradient-to-br from-white via-[#F5FBFA] to-sky-50 shadow-sm">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-teal-100 text-teal-700 ring-1 ring-teal-200">
                {employee.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={employee.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-10 w-10" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-normal text-slate-950 md:text-4xl">{employee.name || "Chưa cập nhật tên"}</h1>
                <div className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-600">
                  <Mail className="h-4 w-4 shrink-0 text-teal-700" />
                  <span className="truncate">{employee.email || "Chưa cập nhật email"}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <HeroInfo icon={<BriefcaseBusiness className="h-4 w-4" />} label="Chức danh" value={employee.position || "Chưa cập nhật"} />
              <HeroInfo icon={<Building2 className="h-4 w-4" />} label="Khoa/phòng" value={employee.department || "Chưa cập nhật"} />
              <HeroInfo icon={<ShieldCheck className="h-4 w-4" />} label="Số GPLH/CCHN" value={employee.licenseNumber || "Chưa cập nhật"} />
              <HeroInfo icon={<CalendarClock className="h-4 w-4" />} label="Ngày cấp" value={employee.licenseIssuedAt ? formatDate(employee.licenseIssuedAt) : "Chưa cập nhật"} />
              <HeroInfo icon={<BarChart3 className="h-4 w-4" />} label="Chu kỳ theo dõi" value={compliance.cycleLabel || "Chưa cấu hình"} />
              <HeroInfo icon={<CalendarClock className="h-4 w-4" />} label="Còn lại" value={remainingDays} />
              <HeroInfo icon={<CheckCircle2 className="h-4 w-4" />} label="Trạng thái CPD" value={compliance.status || "Chưa xác định"} />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[24px] border border-[#D7ECE8] bg-white/76 p-5 shadow-sm">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-sky-700">Tổng quan CPD</div>
              <div className="mt-4 flex items-end gap-3">
                <div className="text-5xl font-bold tracking-normal text-slate-950">{compliance.approvedHours}</div>
                <div className="pb-2 text-sm font-semibold text-slate-500">/ {compliance.requiredHours} tín chỉ</div>
              </div>
              <div className="mt-4 h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-blue-600" style={{ width: `${compliance.completionRate}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-sm text-slate-600">
                <span>Hoàn thành {compliance.completionRate}%</span>
                <span>Còn thiếu {compliance.missingHours} tín chỉ</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/portal/certificates"><Upload className="h-4 w-4" />Cập nhật chứng chỉ</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/portal/certificates"><FileText className="h-4 w-4" />Xem chứng chỉ của tôi</Link>
              </Button>
              <Button type="button" variant="secondary" onClick={exportPersonalReport}>
                <Download className="h-4 w-4" />Xuất báo cáo cá nhân
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Award className="h-6 w-6" />} label="Tín chỉ đã có" value={`${compliance.approvedHours}/${compliance.requiredHours}`} hint="Được tính tự động theo chu kỳ" tone="teal" />
        <KpiCard icon={<AlertCircle className="h-6 w-6" />} label="Còn thiếu" value={`${compliance.missingHours} tín chỉ`} hint="Cần bổ sung trước hạn" tone="amber" />
        <KpiCard icon={<CalendarClock className="h-6 w-6" />} label="Thời gian còn lại" value={remainingDays} hint={`Chu kỳ ${compliance.cycleLabel}`} tone="blue" />
        <KpiCard icon={<FileClock className="h-6 w-6" />} label="Chứng chỉ cần bổ sung" value={`${overview.counts.pending}`} hint="Lấy từ database: hồ sơ thiếu thông tin hoặc đang xử lý OCR" tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-xl">Tình trạng tín chỉ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
            <div className="relative flex aspect-square items-center justify-center rounded-full bg-slate-100">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(#0f766e ${compliance.completionRate * 3.6}deg, #e2e8f0 0deg)` }}
              />
              <div className="relative flex h-[72%] w-[72%] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <div className="text-4xl font-bold text-teal-700">{compliance.approvedHours}</div>
                <div className="text-sm text-slate-500">/ {compliance.requiredHours}</div>
              </div>
            </div>
            <div className="grid content-center gap-4">
              <MetricRow icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} label="Tỷ lệ hoàn thành" value={`${compliance.completionRate}%`} />
              <MetricRow icon={<ShieldCheck className="h-5 w-5 text-amber-600" />} label="Rủi ro" value={compliance.risk || "Vàng"} />
              <MetricRow icon={<AlertCircle className="h-5 w-5 text-red-600" />} label="Còn thiếu" value={`${compliance.missingHours} tín chỉ`} />
              <div className="rounded-[20px] border border-sky-100 bg-sky-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Khuyến nghị tiếp theo
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {guidance}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-xl">Tiến độ theo năm</CardTitle>
            <p className="text-sm text-slate-500">Mục tiêu khuyến nghị: {annualTarget} tín chỉ mỗi năm</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {yearRows.map(({ year, hours, target }) => {
                const percent = target ? Math.min(100, Math.round((hours / target) * 100)) : 0;
                return (
                  <div key={year} className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                    <div className="text-center text-sm font-bold text-slate-700">{year}</div>
                    <div className="mt-4 flex h-24 items-end justify-center">
                      <div className="relative h-full w-7 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                        <div className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-teal-500 to-blue-500" style={{ height: `${Math.max(8, percent)}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 text-center text-sm font-bold text-slate-950">{hours}/{target}</div>
                    <div className="text-center text-xs text-slate-500">tín chỉ</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Việc cần làm của bạn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TodoItem icon={<Upload className="h-5 w-5" />} title="Cập nhật chứng chỉ đã hoàn thành" detail="Upload ảnh/PDF để hệ thống tự kiểm tra theo chu kỳ và cộng tín chỉ nếu được tính." href="/portal/certificates" />
            <TodoItem icon={<GraduationCap className="h-5 w-5" />} title="Bổ sung kế hoạch học tập" detail={`Bạn còn thiếu ${compliance.missingHours} tín chỉ trong chu kỳ hiện tại.`} href="/portal/certificates" />
            <TodoItem icon={<ClipboardList className="h-5 w-5" />} title="Kiểm tra thông tin CCHN" detail="Đảm bảo số CCHN và ngày cấp chính xác để tính chu kỳ 5 năm." href="/portal/profile" />
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Chứng chỉ gần đây</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Các chứng chỉ mới nhất trong hồ sơ cá nhân</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/portal/certificates">Xem tất cả<ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentCertificates.length ? (
              <div className="space-y-3">
                {recentCertificates.map((certificate) => (
                  <div key={certificate.id} className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950">{certificate.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{certificate.issuer || "Chưa cập nhật đơn vị cấp"} · {certificate.issuedDate ? formatDate(certificate.issuedDate) : "Chưa cập nhật ngày cấp"}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-slate-950">{certificate.hours} tín chỉ</div>
                      <div className="mt-1 text-xs font-semibold text-teal-700">{certificate.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#D7ECE8] bg-[#F5FBFA] p-8 text-center">
                <FileUp className="h-10 w-10 text-teal-600" />
                <div className="mt-4 text-base font-bold text-slate-950">Chưa có chứng chỉ nào</div>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Khi bạn tải chứng chỉ lên, danh sách gần đây và tiến độ tín chỉ sẽ được cập nhật tại đây.</p>
                <Button asChild className="mt-4">
                  <Link href="/portal/certificates"><Upload className="h-4 w-4" />Tải chứng chỉ đầu tiên</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HeroInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#D7ECE8] bg-white/70 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate text-sm font-bold text-slate-950">{value}</div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone: "teal" | "blue" | "amber" | "slate" }) {
  const toneClass = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <div className="text-sm font-semibold text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-bold tracking-normal text-slate-950">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{hint}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-[#F5FBFA] px-4 py-3">
      {icon}
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="ml-auto text-sm font-bold text-slate-950">{value}</span>
    </div>
  );
}

function TodoItem({ icon, title, detail, href }: { icon: React.ReactNode; title: string; detail: string; href: string }) {
  return (
    <Link href={href} className="flex gap-3 rounded-[18px] border border-slate-100 bg-slate-50/70 p-4 transition hover:border-teal-200 hover:bg-teal-50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-slate-950">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-500">{detail}</span>
      </span>
    </Link>
  );
}

function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
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
