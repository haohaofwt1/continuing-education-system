import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { certificates } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const certificate = certificates.find((item) => item.code === code) ?? certificates[0];

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle>Xác minh chứng chỉ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-2xl font-bold text-slate-950">{certificate.title}</div>
          <div><StatusBadge status={certificate.status === "Đã duyệt" ? "Hợp lệ" : certificate.status} /></div>
          {[
            ["Người sở hữu", certificate.holder],
            ["Ngày cấp", formatDate(certificate.issuedDate)],
            ["Số tiết", `${certificate.hours}`],
            ["Đơn vị cấp", certificate.issuer],
            ["Mã chứng chỉ", certificate.code]
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b pb-3 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
