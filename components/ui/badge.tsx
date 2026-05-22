import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/mock-data";

const tones: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200"
};

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tones[tone], className)}>
      {children}
    </span>
  );
}
