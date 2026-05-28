import { Download, Edit3, Eye, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type Certificate = {
  id: string;
  title: string;
  holder: string;
  issuedDate: string;
  hours: number;
  status: string;
  thumbnail: string;
  issuer: string;
};

export function CertificateCard({
  certificate,
  onEdit,
  onDelete,
  onView,
  onZoom,
  onDownload
}: {
  certificate: Certificate;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onZoom?: () => void;
  onDownload?: () => void;
}) {
  return (
    <Card className="overflow-hidden border-teal-100 bg-white transition hover:-translate-y-0.5 hover:shadow-xl">
      <button type="button" onClick={onZoom} className="group relative block aspect-[4/3] w-full bg-teal-50 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- Certificate thumbnails can be blob URLs from local uploads. */}
        <img
          src={certificate.thumbnail || "/placeholder-certificate.svg"}
          alt={certificate.title}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = "/placeholder-certificate.svg";
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/35 to-transparent" />
        <div className="absolute left-3 top-3"><StatusBadge status={certificate.status} /></div>
        <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Click để zoom
        </div>
      </button>
      <CardContent className="p-4">
        <div className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-slate-950">{certificate.title}</div>
        <div className="mt-2 truncate text-sm font-medium text-slate-500">{certificate.holder}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-400">Ngày cấp</div>
            <div className="font-semibold">{formatDate(certificate.issuedDate)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Số tiết</div>
            <div className="font-semibold">{certificate.hours}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" size="icon" aria-label="Xem chi tiết" onClick={onView}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Sửa" onClick={onEdit}><Edit3 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Tải xuống" onClick={onDownload}><Download className="h-4 w-4" /></Button>
          {onDelete ? <Button variant="ghost" size="icon" aria-label="Xóa" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}
