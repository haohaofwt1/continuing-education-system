import { AlertTriangle, CheckCircle2, CircleDot, Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProductionReadiness } from "@/lib/production-readiness";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const readiness = await getProductionReadiness();

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Production readiness"
        description="Kiểm tra các điều kiện tối thiểu trước khi deploy/bán thương mại: database, auth, storage, AI, realtime và demo fallback."
        actions={<Button asChild><Link href="/admin/settings"><Settings className="h-4 w-4" />Cài đặt</Link></Button>}
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Trạng thái" value={readiness.ready ? "Sẵn sàng" : "Chưa sẵn sàng"} tone={readiness.ready ? "green" : "red"} />
        <SummaryCard label="Lỗi chặn deploy" value={String(readiness.failed)} tone={readiness.failed ? "red" : "green"} />
        <SummaryCard label="Cảnh báo" value={String(readiness.warnings)} tone={readiness.warnings ? "yellow" : "green"} />
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {readiness.checks.map((check) => (
            <div key={check.key} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_120px_1fr]">
              <div className="flex items-center gap-3 font-semibold text-slate-950">
                {check.status === "pass" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : check.status === "warn" ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CircleDot className="h-5 w-5 text-red-600" />}
                {check.label}
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${check.status === "pass" ? "bg-emerald-50 text-emerald-700" : check.status === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                {check.status}
              </span>
              <div className="text-sm leading-6 text-slate-600">{check.detail}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "green" | "yellow" | "red" }) {
  const color = tone === "green" ? "text-emerald-700 bg-emerald-50" : tone === "yellow" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={`mt-3 w-fit rounded-2xl px-3 py-1 text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
