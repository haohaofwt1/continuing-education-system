"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, Download, FileClock, FileText, Plus, Users } from "lucide-react";
import { CertificateMonthlyChart, DepartmentHoursChart } from "@/components/dashboard/dashboard-charts";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoCertificate, DemoEmployee, downloadCsv } from "@/lib/demo-store";

const cycleStart = new Date("2025-01-01T00:00:00");
const cycleEnd = new Date("2026-12-31T23:59:59");
const today = new Date("2026-05-21T00:00:00");

export function DashboardClient() {
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [certificates, setCertificates] = useState<DemoCertificate[]>([]);

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((payload) => setEmployees(payload.data))
      .catch(() => setEmployees([]));

    fetch("/api/certificates")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((payload) => setCertificates(payload.data))
      .catch(() => setCertificates([]));
  }, []);

  const cycleCertificates = certificates.filter((certificate) => isInCycle(certificate.issuedDate));
  const missingHours = employees.filter((employee) => employee.hours < employee.requiredHours);
  const missingLicense = employees.filter((employee) => !employee.licenseNumber || employee.status === "Thiếu CCHN");
  const needsInfoCertificates = certificates.filter((certificate) => certificate.status === "Cần nhập thêm thông tin");
  const expiringCertificates = certificates.filter(isExpiringSoon);
  const totalRequiredHours = employees.reduce((sum, employee) => sum + employee.requiredHours, 0);
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const averageHours = employees.length ? totalHours / employees.length : 0;
  const compliance = totalRequiredHours ? Math.round((totalHours / totalRequiredHours) * 100) : 0;
  const departmentsActive = new Set(employees.map((employee) => employee.department)).size;
  const monthlyData = buildMonthlyData(cycleCertificates);
  const departmentHours = Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((department) => ({
    department,
    hours: employees.filter((employee) => employee.department === department).reduce((sum, employee) => sum + employee.hours, 0)
  }));
  const attentionCertificates = [
    ...needsInfoCertificates,
    ...expiringCertificates,
    ...certificates.filter((certificate) => certificate.status === "Nghi trùng lặp")
  ].filter(uniqueCertificate).slice(0, 6);
  const workItems = [
    { label: "Chứng chỉ cần nhập thêm", value: needsInfoCertificates.length, href: "/certificates" },
    { label: "Nhân sự thiếu số tiết", value: missingHours.length, href: "/employees" },
    { label: "Hồ sơ thiếu số CCHN", value: missingLicense.length, href: "/employees" },
    { label: "Chứng chỉ sắp hết hạn", value: expiringCertificates.length, href: "/certificates" }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan vận hành"
        title="Dashboard tuân thủ đào tạo liên tục"
        description="Tổng hợp theo dữ liệu nhân sự và chứng chỉ đang chỉnh sửa trong hệ thống."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv("dashboard-chung-chi-can-chu-y.csv", attentionCertificates)}><Download className="h-4 w-4" />Export cảnh báo</Button>
            <Button asChild><Link href="/certificates"><Plus className="h-4 w-4" />Thêm chứng chỉ</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Tổng nhân sự" value={String(employees.length)} hint={`${departmentsActive} khoa/phòng đang hoạt động`} icon={Users} />
        <MetricCard title="Chứng chỉ trong chu kỳ" value={String(cycleCertificates.length)} hint={`${certificates.length} chứng chỉ toàn hệ thống`} icon={FileText} />
        <MetricCard title="Số tiết TB / nhân sự" value={averageHours.toFixed(1)} hint={`Yêu cầu trung bình ${employees.length ? Math.round(totalRequiredHours / employees.length) : 0} tiết`} icon={ClipboardCheck} />
        <MetricCard title="Tỷ lệ tuân thủ" value={`${compliance}%`} hint={`${missingHours.length} người còn thiếu số tiết`} icon={AlertTriangle} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Thiếu số tiết" value={`${missingHours.length} người`} hint="Cần nhắc bổ sung" icon={AlertTriangle} />
        <MetricCard title="Sắp hết hạn" value={`${expiringCertificates.length} chứng chỉ`} hint="Trong 60 ngày tới" icon={FileClock} />
        <MetricCard title="Cần nhập thêm" value={`${needsInfoCertificates.length} chứng chỉ`} hint="Thiếu dữ liệu để tự tính" icon={ClipboardCheck} />
        <MetricCard title="Thiếu số CCHN" value={`${missingLicense.length} hồ sơ`} hint="Cần cập nhật dữ liệu" icon={Users} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Số chứng chỉ theo tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <CertificateMonthlyChart data={monthlyData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Số tiết theo khoa/phòng</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentHoursChart data={departmentHours} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Việc cần xử lý</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-2xl border bg-teal-50/60 p-4 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50">
                <span>{item.label}</span>
                <span className="text-lg font-bold text-slate-950">{item.value}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chứng chỉ cần chú ý</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-3">Chứng chỉ</th>
                  <th>Nhân sự</th>
                  <th>Ngày cấp</th>
                  <th>Số tiết</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attentionCertificates.length ? attentionCertificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <td className="py-4 font-semibold text-slate-900">{certificate.title}</td>
                    <td>{certificate.holder}</td>
                    <td>{certificate.issuedDate || "Chưa có"}</td>
                    <td>{certificate.hours}</td>
                    <td><StatusBadge status={certificate.status} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td className="py-6 text-slate-500" colSpan={5}>Không có chứng chỉ cần xử lý.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function isInCycle(dateValue: string) {
  const date = parseDate(dateValue);
  return Boolean(date && date >= cycleStart && date <= cycleEnd);
}

function isExpiringSoon(certificate: DemoCertificate) {
  const expiredDate = parseDate(certificate.expiredDate);
  if (!expiredDate) return false;
  const diffDays = (expiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 60;
}

function buildMonthlyData(certificates: DemoCertificate[]) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const items = certificates.filter((certificate) => {
      const date = parseDate(certificate.issuedDate);
      return date?.getFullYear() === 2026 && date.getMonth() + 1 === month;
    });
    return {
      month: `T${month}`,
      certificates: items.length,
      hours: items.reduce((sum, certificate) => sum + certificate.hours, 0)
    };
  });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueCertificate(certificate: DemoCertificate, index: number, list: DemoCertificate[]) {
  return list.findIndex((item) => item.id === certificate.id) === index;
}
