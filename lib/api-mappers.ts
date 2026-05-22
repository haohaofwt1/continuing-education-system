import type { CertificateReviewStatus, User, Certificate, Department, Position, Role, CertificateType } from "@prisma/client";
import type { StatusTone } from "@/lib/mock-data";

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
};

const reviewStatusToLabel: Record<CertificateReviewStatus, string> = {
  PROCESSING: "Đang xử lý",
  OCR_FAILED: "Đọc lỗi",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  MISSING_INFO: "Thiếu thông tin",
  VALID: "Hợp lệ",
  EXPIRING_SOON: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
  DUPLICATE_SUSPECTED: "Nghi trùng",
  EXCLUDED_FROM_CYCLE: "Không tính chu kỳ"
};

const labelToReviewStatus: Record<string, CertificateReviewStatus> = {
  "Đang xử lý": "PROCESSING",
  "Đọc lỗi": "OCR_FAILED",
  "Chờ xác nhận": "PENDING_CONFIRMATION",
  "Chờ duyệt": "PENDING_REVIEW",
  "Đã duyệt": "APPROVED",
  "Từ chối": "REJECTED",
  "Thiếu thông tin": "MISSING_INFO",
  "Hợp lệ": "VALID",
  "Sắp hết hạn": "EXPIRING_SOON",
  "Đã hết hạn": "EXPIRED",
  "Nghi trùng": "DUPLICATE_SUSPECTED",
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
    status: record.status === "LOCKED" ? "Tạm khóa" : record.licenseNumber ? "Hoạt động" : "Thiếu CCHN",
    hours: summary?.approvedHours ?? 0,
    requiredHours: summary?.requiredHours ?? record.position?.requiredHours ?? 48,
    avatarUrl: record.avatarUrl ?? ""
  };
}

export function mapCertificate(record: CertificateRecord) {
  const status = reviewStatusToLabel[record.reviewStatus] ?? "Chờ duyệt";
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
    issuePlace: ""
  };
}

export function toReviewStatus(status?: string): CertificateReviewStatus {
  return status ? labelToReviewStatus[status] ?? "PENDING_REVIEW" : "PENDING_REVIEW";
}

export function toAccountStatus(status?: string | null): "LOCKED" | "ACTIVE" {
  return status === "Tạm khóa" ? "LOCKED" : "ACTIVE";
}

function statusTone(status: string): StatusTone {
  if (["Đã duyệt", "Hợp lệ"].includes(status)) return "green";
  if (["Từ chối", "Đã hết hạn"].includes(status)) return "red";
  if (["Thiếu thông tin", "Đọc lỗi", "Không tính chu kỳ"].includes(status)) return "gray";
  return "yellow";
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}
