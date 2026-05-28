import type { CertificateReviewStatus, User, Certificate, Department, Position, Role, CertificateType, TrainingCycle } from "@prisma/client";
import type { StatusTone } from "@/lib/mock-data";
import { certificateCycleAssessment } from "@/lib/training-rules";

type EmployeeRecord = User & {
  department: Department | null;
  position: Position | null;
  role: Role | null;
  summaries?: Array<{ approvedHours: number; requiredHours: number }>;
};

type CertificateRecord = Certificate & {
  holder: User | null;
  department: Department | null;
  position: Position | null;
  certificateType: CertificateType | null;
  trainingCycle?: TrainingCycle | null;
};

const reviewStatusToLabel: Record<CertificateReviewStatus, string> = {
  PROCESSING: "Đang xử lý",
  OCR_FAILED: "Đọc lỗi",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  PENDING_REVIEW: "Cần nhập thêm thông tin",
  APPROVED: "Được tính",
  REJECTED: "Không tính",
  MISSING_INFO: "Cần nhập thêm thông tin",
  VALID: "Hợp lệ",
  EXPIRING_SOON: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
  DUPLICATE_SUSPECTED: "Nghi trùng lặp",
  EXCLUDED_FROM_CYCLE: "Không tính"
};

const labelToReviewStatus: Record<string, CertificateReviewStatus> = {
  "Đang xử lý": "PROCESSING",
  "Đọc lỗi": "OCR_FAILED",
  "Chờ xác nhận": "PENDING_CONFIRMATION",
  "Chờ duyệt": "PENDING_REVIEW",
  "Cần nhập thêm thông tin": "MISSING_INFO",
  "Cần nhập thêm": "MISSING_INFO",
  "Đã duyệt": "APPROVED",
  "Được tính": "APPROVED",
  "Từ chối": "REJECTED",
  "Không tính": "REJECTED",
  "Thiếu thông tin": "MISSING_INFO",
  "Hợp lệ": "VALID",
  "Sắp hết hạn": "EXPIRING_SOON",
  "Đã hết hạn": "EXPIRED",
  "Nghi trùng": "DUPLICATE_SUSPECTED",
  "Nghi trùng lặp": "DUPLICATE_SUSPECTED",
  "Không tính chu kỳ": "EXCLUDED_FROM_CYCLE"
};

export function mapEmployee(record: EmployeeRecord) {
  const summary = record.summaries?.[0];
  return {
    id: record.id,
    name: record.name,
    username: record.username,
    email: record.email,
    phone: record.phone ?? "",
    department: record.department?.name ?? "",
    position: record.position?.name ?? "",
    role: record.role?.name ?? "Nhân viên",
    licenseNumber: record.licenseNumber ?? "",
    licenseIssuedAt: formatDate(record.licenseIssuedAt),
    status: record.status === "LOCKED" ? "Tạm khóa" : record.licenseNumber ? "Hoạt động" : "Thiếu CCHN",
    hours: summary?.approvedHours ?? 0,
    requiredHours: summary?.requiredHours ?? record.position?.requiredHours ?? 48,
    avatarUrl: record.avatarUrl ?? ""
  };
}

export function mapCertificate(record: CertificateRecord) {
  const status = reviewStatusToLabel[record.reviewStatus] ?? "Cần nhập thêm thông tin";
  const calculation = certificateCalculation(record);
  const cycleAssessment = record.trainingCycleId
    ? { countedHours: record.includeInCycle ? record.creditHours : 0, reason: "Được gán vào chu kỳ đào tạo hiện tại." }
    : certificateCycleAssessment({ issuedDate: formatDate(record.issuedDate), hours: record.creditHours }, { startYear: new Date().getFullYear(), endYear: new Date().getFullYear() });
  return {
    id: record.id,
    code: record.certificateCode ?? record.id,
    title: record.title,
    holder: record.holder?.name ?? "",
    department: record.department?.name ?? "",
    position: record.position?.name ?? "",
    type: record.certificateType?.name ?? "Đào tạo liên tục",
    issuer: record.issuingOrganization ?? "",
    issuedDate: formatDate(record.issuedDate),
    expiredDate: formatDate(record.expiredDate) || null,
    hours: record.creditHours,
    proposedCredits: record.creditHours,
    countedCredits: calculation.status === "counted" ? record.creditHours : 0,
    recognizedCredits: calculation.status === "counted" ? record.creditHours : 0,
    issueDate: formatDate(record.issuedDate),
    status,
    tone: statusTone(status),
    ocrStatus: record.ocrStatus === "SUCCEEDED" ? "Đã đọc" : record.ocrStatus === "FAILED" ? "Đọc lỗi" : record.ocrStatus === "PROCESSING" ? "Đang đọc" : "Chờ đọc",
    confidence: record.confidence ?? 0,
    thumbnail: record.thumbnailUrl ?? record.fileUrl ?? "/placeholder-certificate.svg",
    fileUrl: record.fileUrl,
    fileName: null,
    fileMimeType: null,
    fileSizeBytes: null,
    rawText: "",
    certificateNumber: record.certificateCode,
    holderBirthDate: "",
    holderAddress: "",
    studyStartDate: "",
    studyEndDate: "",
    equivalentCredits: record.creditHours,
    responsibleUnit: record.issuingOrganization ?? "",
    learningFormat: "",
    courseContent: record.courseContent ?? "",
    verificationNumber: record.certificateCode,
    issuePlace: "",
    includeInCycle: record.includeInCycle,
    cycleCountedHours: record.includeInCycle ? record.creditHours : 0,
    cycleReason: record.includeInCycle ? cycleAssessment.reason : "Không cộng vào chu kỳ hiện tại.",
    cycleStart: record.trainingCycle ? `${record.trainingCycle.startYear}-01-01` : null,
    cycleEnd: record.trainingCycle ? `${record.trainingCycle.endYear}-12-31` : null,
    cycleId: record.trainingCycleId,
    calculationStatus: calculation.status,
    calculationReason: calculation.reason,
    uploadedBy: record.holderId,
    employeeId: record.holderId,
    isDuplicateSuspected: record.reviewStatus === "DUPLICATE_SUSPECTED",
    createdAt: formatDate(record.createdAt),
    updatedAt: formatDate(record.updatedAt)
  };
}

export function toReviewStatus(status?: string): CertificateReviewStatus {
  return status ? labelToReviewStatus[status] ?? "MISSING_INFO" : "MISSING_INFO";
}

export function toAccountStatus(status?: string | null): "LOCKED" | "ACTIVE" {
  return status === "Tạm khóa" ? "LOCKED" : "ACTIVE";
}

function statusTone(status: string): StatusTone {
  if (["Được tính", "Đã duyệt", "Hợp lệ"].includes(status)) return "green";
  if (["Không tính", "Từ chối", "Đã hết hạn"].includes(status)) return "red";
  if (["Cần nhập thêm thông tin", "Thiếu thông tin", "Đọc lỗi", "Không tính chu kỳ"].includes(status)) return "gray";
  return "yellow";
}

function certificateCalculation(record: CertificateRecord) {
  if (record.reviewStatus === "DUPLICATE_SUSPECTED") {
    return { status: "duplicate_suspected", reason: "Hệ thống phát hiện mã hoặc thông tin chứng chỉ có khả năng trùng lặp." };
  }
  if (record.reviewStatus === "MISSING_INFO" || !record.title || !record.issuedDate || !record.creditHours || !record.certificateCode) {
    return { status: "needs_info", reason: record.notes || "Thiếu trường bắt buộc nên tín chỉ chưa được tính." };
  }
  if (!record.includeInCycle || record.reviewStatus === "EXCLUDED_FROM_CYCLE") {
    return { status: "out_of_cycle", reason: "Ngày cấp nằm ngoài chu kỳ 5 năm hiện tại." };
  }
  if (record.reviewStatus === "APPROVED") {
    return { status: "counted", reason: "Ngày cấp nằm trong chu kỳ hiện tại, tín chỉ được cộng tự động." };
  }
  return { status: "needs_info", reason: "Hệ thống cần thêm dữ liệu để tự tính tín chỉ." };
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}
