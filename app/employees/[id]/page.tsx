"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCertificates, getEmployees, type DemoCertificate, type DemoEmployee } from "@/lib/demo-store";

type ApiList<T> = {
  data?: T[];
};

async function loadList<T>(url: string, fallback: T[]) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as ApiList<T>;
    return Array.isArray(payload.data) && payload.data.length ? payload.data : fallback;
  } catch {
    return fallback;
  }
}

function certificateHolderName(certificate: DemoCertificate) {
  const holder = certificate.holder;
  if (typeof holder === "string") return holder;
  return "";
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params?.id;
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [certificates, setCertificates] = useState<DemoCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const localEmployees = getEmployees();
      const localCertificates = getCertificates();
      const [remoteEmployees, remoteCertificates] = await Promise.all([
        loadList<DemoEmployee>("/api/employees", localEmployees),
        loadList<DemoCertificate>("/api/certificates", localCertificates)
      ]);

      if (!mounted) return;
      setEmployees(remoteEmployees);
      setCertificates(remoteCertificates);
      setLoading(false);
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const employee = useMemo(() => employees.find((item) => item.id === employeeId), [employeeId, employees]);
  const ownedCertificates = useMemo(() => {
    if (!employee) return [];
    return certificates.filter((certificate) => certificateHolderName(certificate).trim().toLowerCase() === employee.name.trim().toLowerCase());
  }, [certificates, employee]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Chi tiết nhân sự" title="Đang tải hồ sơ" description="Đang đồng bộ dữ liệu nhân sự và chứng chỉ." />
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">Vui lòng chờ trong giây lát.</CardContent>
        </Card>
      </>
    );
  }

  if (!employee) {
    return (
      <>
        <PageHeader
          eyebrow="Chi tiết nhân sự"
          title="Không tìm thấy hồ sơ"
          description="Hồ sơ này có thể đã bị xóa, chưa đồng bộ vào cơ sở dữ liệu, hoặc đường dẫn đang trỏ tới ID cũ."
          actions={
            <Button asChild variant="secondary">
              <Link href="/employees"><ArrowLeft className="h-4 w-4" />Về danh sách nhân sự</Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            Hệ thống không tìm thấy mã hồ sơ <span className="font-semibold text-slate-900">{employeeId}</span>. Hãy kiểm tra lại danh sách nhân sự hoặc mở chức năng sửa hồ sơ từ trang danh sách.
          </CardContent>
        </Card>
      </>
    );
  }

  const approvedHours = employee.hours ?? 0;
  const requiredHours = employee.requiredHours || 120;
  const missingHours = Math.max(requiredHours - approvedHours, 0);
  const compliant = approvedHours >= requiredHours;
  const progress = requiredHours > 0 ? Math.min((approvedHours / requiredHours) * 100, 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Chi tiết nhân sự"
        title={employee.name}
        description={`${employee.position} · ${employee.department}`}
        actions={
          <>
            <Button variant="secondary"><Bell className="h-4 w-4" />Nhắc bổ sung</Button>
            <Button><Download className="h-4 w-4" />Xuất hồ sơ PDF</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader><CardTitle>Thông tin cá nhân</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {[
              ["Email", employee.email],
              ["Số điện thoại", employee.phone || "Chưa cập nhật"],
              ["Tên đăng nhập", employee.username || "Chưa cập nhật"],
              ["Vai trò", employee.role || "Nhân sự"],
              ["Khoa/phòng", employee.department || "Chưa cập nhật"],
              ["Chức danh", employee.position || "Chưa cập nhật"],
              ["Số CCHN", employee.licenseNumber || "Chưa cập nhật"],
              ["Ngày bắt đầu chu kỳ", employee.licenseIssuedAt || employee.complianceCycleStartDate || "Chưa cập nhật"],
              ["Trạng thái", employee.status]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b pb-3">
                <span className="text-slate-500">{label}</span>
                <span className="text-right font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tổng số tiết theo chu kỳ</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-5xl font-bold text-slate-950">{approvedHours}</div>
              <div>
                <div className="text-sm text-slate-500">Yêu cầu {requiredHours} tiết · còn thiếu {missingHours} tiết</div>
                <div className="mt-2"><StatusBadge status={compliant ? "Đạt" : "Chưa đạt"} /></div>
              </div>
            </div>
            <div className="mt-6 h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-teal-600" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Số tiết được tính theo chứng chỉ đã duyệt và ngày tín chỉ nằm trong chu kỳ tuân thủ của nhân sự.
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Danh sách chứng chỉ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ownedCertificates.length ? ownedCertificates.map((certificate) => (
            <div key={certificate.id} className="flex items-center justify-between rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-teal-700" />
                <div>
                  <div className="font-semibold">{certificate.title}</div>
                  <div className="text-sm text-slate-500">{certificate.issuer || "Chưa cập nhật đơn vị cấp"} · {certificate.hours ?? 0} tiết</div>
                </div>
              </div>
              <StatusBadge status={certificate.status} />
            </div>
          )) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Chưa có chứng chỉ nào trong chu kỳ.</div>}
        </CardContent>
      </Card>
    </>
  );
}
