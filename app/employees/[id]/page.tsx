import { notFound } from "next/navigation";
import { Bell, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { certificates, employees } from "@/lib/mock-data";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = employees.find((item) => item.id === id);
  if (!employee) notFound();
  const ownedCertificates = certificates.filter((certificate) => certificate.holder === employee.name);
  const compliant = employee.hours >= employee.requiredHours;

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
              ["Số điện thoại", employee.phone],
              ["Tên đăng nhập", employee.username],
              ["Vai trò", employee.role],
              ["Số CCHN", employee.licenseNumber || "Chưa cập nhật"],
              ["Trạng thái", employee.status]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b pb-3">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tổng số tiết theo chu kỳ</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-5xl font-bold text-slate-950">{employee.hours}</div>
              <div>
                <div className="text-sm text-slate-500">Yêu cầu {employee.requiredHours} tiết · còn thiếu {Math.max(employee.requiredHours - employee.hours, 0)} tiết</div>
                <div className="mt-2"><StatusBadge status={compliant ? "Đạt" : "Chưa đạt"} /></div>
              </div>
            </div>
            <div className="mt-6 h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-teal-600" style={{ width: `${Math.min((employee.hours / employee.requiredHours) * 100, 100)}%` }} />
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
                  <div className="text-sm text-slate-500">{certificate.issuer} · {certificate.hours} tiết</div>
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
