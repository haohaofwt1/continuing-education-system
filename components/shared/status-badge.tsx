import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/mock-data";

const map: Record<string, StatusTone> = {
  "Được tính": "green",
  "Đã duyệt": "green",
  "Hợp lệ": "green",
  "Đạt": "green",
  "Hoạt động": "green",
  "Chờ duyệt": "yellow",
  "Sắp hết hạn": "yellow",
  "Cần bổ sung": "yellow",
  "Cần nhập thêm thông tin": "gray",
  "Nghi trùng lặp": "yellow",
  "Thiếu thông tin": "gray",
  "Thiếu CCHN": "gray",
  "Đã hết hạn": "red",
  "Không tính": "red",
  "Từ chối": "red",
  "Chưa đạt": "red",
  "Tạm khóa": "red"
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={map[status] ?? "gray"}>{status}</Badge>;
}
