export type StatusTone = "green" | "yellow" | "red" | "gray" | "blue";

export const departments = ["Phòng khám", "Phòng xét nghiệm", "Phòng chẩn đoán hình ảnh", "Phòng Dược"];
export const positions = ["Bác sĩ", "Dược sĩ", "Điều dưỡng", "Kỹ thuật viên", "Nữ hộ sinh", "Y sĩ"];

export const employees = [
  { id: "u1", name: "Nguyễn Văn An", username: "nvan", email: "an@example.com", phone: "0901000001", department: "Phòng khám", position: "Bác sĩ", role: "Quản lý khoa/phòng", licenseNumber: "CCHN-1001", status: "Hoạt động", hours: 32, requiredHours: 48 },
  { id: "u2", name: "Trần Thị Bình", username: "ttbinh", email: "binh@example.com", phone: "0901000002", department: "Phòng xét nghiệm", position: "Kỹ thuật viên", role: "Nhân viên", licenseNumber: "CCHN-1002", status: "Hoạt động", hours: 52, requiredHours: 36 },
  { id: "u3", name: "Lê Quốc Cường", username: "lqcuong", email: "cuong@example.com", phone: "0901000003", department: "Phòng chẩn đoán hình ảnh", position: "Bác sĩ", role: "Người kiểm duyệt", licenseNumber: "", status: "Thiếu CCHN", hours: 18, requiredHours: 48 },
  { id: "u4", name: "Phạm Minh Châu", username: "pmchau", email: "chau@example.com", phone: "0901000004", department: "Phòng Dược", position: "Dược sĩ", role: "Nhân viên", licenseNumber: "CCHN-1004", status: "Hoạt động", hours: 44, requiredHours: 48 },
  { id: "u5", name: "Hoàng Thị Dung", username: "htdung", email: "dung@example.com", phone: "0901000005", department: "Phòng khám", position: "Điều dưỡng", role: "Nhân viên", licenseNumber: "CCHN-1005", status: "Hoạt động", hours: 12, requiredHours: 48 },
  { id: "u6", name: "Đỗ Thanh Hải", username: "dthai", email: "hai@example.com", phone: "0901000006", department: "Phòng xét nghiệm", position: "Kỹ thuật viên", role: "Nhân viên", licenseNumber: "CCHN-1006", status: "Tạm khóa", hours: 28, requiredHours: 36 },
  { id: "u7", name: "Võ Ngọc Lan", username: "vnlan", email: "lan@example.com", phone: "0901000007", department: "Phòng chẩn đoán hình ảnh", position: "Nữ hộ sinh", role: "Nhân viên", licenseNumber: "", status: "Thiếu CCHN", hours: 48, requiredHours: 48 },
  { id: "u8", name: "Bùi Đức Minh", username: "bdminh", email: "minh@example.com", phone: "0901000008", department: "Phòng Dược", position: "Y sĩ", role: "Người chỉ xem báo cáo", licenseNumber: "CCHN-1008", status: "Hoạt động", hours: 8, requiredHours: 36 },
  { id: "u9", name: "Đặng Thu Nga", username: "dtnga", email: "nga@example.com", phone: "0901000009", department: "Phòng khám", position: "Điều dưỡng", role: "Nhân viên", licenseNumber: "CCHN-1009", status: "Hoạt động", hours: 64, requiredHours: 48 },
  { id: "u10", name: "Mai Anh Tuấn", username: "matuan", email: "tuan@example.com", phone: "0901000010", department: "Phòng Dược", position: "Dược sĩ", role: "Admin đơn vị", licenseNumber: "CCHN-1010", status: "Hoạt động", hours: 22, requiredHours: 48 }
];

export const certificates = [
  { id: "c1", code: "CERT-2026-001", title: "Kiểm soát nhiễm khuẩn cơ bản", holder: "Nguyễn Văn An", department: "Phòng khám", position: "Bác sĩ", type: "Kiểm soát nhiễm khuẩn", issuer: "Bệnh viện Trung tâm", issuedDate: "2026-01-12", expiredDate: "2026-11-30", hours: 12, status: "Đã duyệt", tone: "green" as StatusTone, ocrStatus: "Đã đọc", confidence: 0.93, thumbnail: "/placeholder-certificate.svg" },
  { id: "c2", code: "CERT-2026-002", title: "Cập nhật cấp cứu ban đầu", holder: "Trần Thị Bình", department: "Phòng xét nghiệm", position: "Kỹ thuật viên", type: "Cấp cứu", issuer: "Trường Đại học Y Dược", issuedDate: "2026-02-08", expiredDate: null, hours: 24, status: "Chờ duyệt", tone: "yellow" as StatusTone, ocrStatus: "Chờ xác nhận", confidence: 0.86, thumbnail: "/placeholder-certificate.svg" },
  { id: "c3", code: "CERT-2026-003", title: "An toàn người bệnh nâng cao", holder: "Lê Quốc Cường", department: "Phòng chẩn đoán hình ảnh", position: "Bác sĩ", type: "An toàn người bệnh", issuer: "Sở Y tế", issuedDate: "2026-03-16", expiredDate: null, hours: 8, status: "Thiếu thông tin", tone: "gray" as StatusTone, ocrStatus: "Đọc lỗi", confidence: 0.51, thumbnail: "/placeholder-certificate.svg" },
  { id: "c4", code: "CERT-2026-004", title: "Dược lâm sàng và sử dụng thuốc an toàn", holder: "Phạm Minh Châu", department: "Phòng Dược", position: "Dược sĩ", type: "Dược lâm sàng", issuer: "Hội Dược học", issuedDate: "2025-12-21", expiredDate: "2026-06-28", hours: 16, status: "Sắp hết hạn", tone: "yellow" as StatusTone, ocrStatus: "Đã đọc", confidence: 0.9, thumbnail: "/placeholder-certificate.svg" },
  { id: "c5", code: "CERT-2025-019", title: "Đào tạo liên tục chuyên ngành điều dưỡng", holder: "Hoàng Thị Dung", department: "Phòng khám", position: "Điều dưỡng", type: "Đào tạo liên tục", issuer: "Trung tâm đào tạo Y khoa", issuedDate: "2025-04-05", expiredDate: "2026-01-01", hours: 12, status: "Đã hết hạn", tone: "red" as StatusTone, ocrStatus: "Đã đọc", confidence: 0.88, thumbnail: "/placeholder-certificate.svg" }
];

export const chartByMonth = [
  { month: "T1", certificates: 18, hours: 168 },
  { month: "T2", certificates: 24, hours: 220 },
  { month: "T3", certificates: 19, hours: 176 },
  { month: "T4", certificates: 31, hours: 312 },
  { month: "T5", certificates: 27, hours: 284 }
];

export const hoursByDepartment = departments.map((department, index) => ({
  department,
  hours: [288, 226, 194, 244][index],
  compliance: [72, 81, 64, 76][index]
}));

export const tasksToday = [
  "Duyệt 5 chứng chỉ đang chờ",
  "Nhắc 15 nhân sự thiếu số tiết",
  "Rà soát 12 hồ sơ thiếu số CCHN",
  "Kiểm tra 3 chứng chỉ nghi trùng"
];

export const reports = [
  { id: "r1", name: "Tổng hợp đào tạo liên tục năm 2026", type: "Tổng hợp", rows: 128, updatedAt: "2026-05-20" },
  { id: "r2", name: "Số tiết theo khoa/phòng", type: "Khoa/phòng", rows: 4, updatedAt: "2026-05-18" },
  { id: "r3", name: "Chứng chỉ sắp hết hạn", type: "Cảnh báo", rows: 8, updatedAt: "2026-05-17" }
];
