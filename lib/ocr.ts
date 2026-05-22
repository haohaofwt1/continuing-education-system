import { z } from "zod";

export const extractedCertificateSchema = z.object({
  certificateNumber: z.string().nullable().default(null),
  certificateTitle: z.string(),
  holderName: z.string(),
  holderBirthDate: z.string().nullable().default(null),
  holderAddress: z.string().nullable().default(null),
  issuedDate: z.string().nullable(),
  expiredDate: z.string().nullable(),
  studyStartDate: z.string().nullable().default(null),
  studyEndDate: z.string().nullable().default(null),
  creditHours: z.number().nonnegative(),
  equivalentCredits: z.number().nonnegative().nullable().default(null),
  issuingOrganization: z.string(),
  responsibleUnit: z.string().nullable().default(null),
  certificateType: z.string(),
  learningFormat: z.string().nullable().default(null),
  courseContent: z.string(),
  verificationNumber: z.string().nullable().default(null),
  issuePlace: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1)
});

export type ExtractedCertificateData = z.infer<typeof extractedCertificateSchema>;

export async function extractTextFromImage(fileUrl: string) {
  if (isThuongSample(fileUrl)) {
    return `MOCK OCR TEXT - SAMPLE dthuong_20042026.jpeg
TONG HOI Y HOC VIET NAM
VIEN SUC KHOE CONG DONG
So CC: 44/2025/BB1-BYT
CHUNG CHI DAO TAO LIEN TUC
Chung nhan: Doan Thi Thuong
Sinh ngay: 01/01/1995
Don vi cong tac: Phong kham Da khoa Medic, Thanh pho Hue
Da hoan thanh khoa hoc theo chuong trinh dao tao lien tuc cap nhat kien thuc:
Kiem soat nhiem khuan trong cac co so kham benh, chua benh
Tong so: 48 tiet hoc
Tu ngay 10 thang 02 nam 2025 den ngay 18 thang 02 nam 2025
Ha Noi, ngay 05 thang 03 nam 2025
VIEN TRUONG
PGS.TS. PHAM VAN THAO`;
  }

  if (isNgocSample(fileUrl)) {
    return `MOCK OCR TEXT - SAMPLE ntbngoc_09042026.jpeg
TRUNG UONG HOI DONG Y VIET NAM
VIEN DONG Y VIET NAM
So: YS032/CNCNKTYK.K01-2026
GIAY CHUNG NHAN
THAM GIA CAP NHAT KIEN THUC Y KHOA LIEN TUC TRONG KHAM BENH, CHUA BENH
Chung nhan Ong/Ba: Nguyen Thi Bich Ngoc
Sinh ngay: 20.08.1991
Dia chi/Don vi: 6/122 Ly Thai To, phuong Huong An, thanh pho Hue
Hinh thuc: Dao tao, boi duong ngan han
Noi dung: CAP NHAT KET HOP YHCT VA YHHD TRONG DIEU TRI BENH HO HAP MAN TINH (HEN PHE QUAN - VIEM PHE QUAN MAN - COPD)
Don vi chiu trach nhiem: Vien Dong Y Viet Nam
Thoi gian hoc: Tu ngay 14/01/2026 den 25/01/2026
So tiet: 48 tiet
Quy doi tuong duong: 48 Gio tin chi
So chung thuc: 24.56
Quyen so: 02-SCT/BS
Ha Noi, Ngay 26 thang 01 nam 2026`;
  }

  if (isTrangSample(fileUrl)) {
    return `MOCK OCR TEXT - SAMPLE ntttrang_18042026.jpg
BO Y TE
BENH VIEN TRUNG HUE
So: 00035/2026/H44-DT
GIAY CHUNG NHAN
THAM GIA CAP NHAT KIEN THUC Y KHOA LIEN TUC TRONG KHAM BENH, CHUA BENH
Chung nhan: CNHS. Nguyen Thi Thuy Trang
Sinh nam: 1983
Don vi cong tac: Phong kham da khoa An Phuoc
Da hoan thanh cap nhat kien thuc y khoa lien tuc y khoa theo chu de voi cac noi dung nhu sau:
Hinh thuc: Tham du Hoi thao chuyen mon
Chu de: Tam than 2026 trong sieu am san khoa va tim thai
Don vi chiu trach nhiem: Benh vien Trung uong Hue
Thoi gian: Ngay 16/01/2026
Quy doi tuong duong: 03 gio tin chi (Ba gio tin chi)
TP Hue, ngay 02 thang 02 nam 2026
PHO GIAM DOC
PGS.TS. Nguyen Thanh Xuan`;
  }

  return `MOCK OCR TEXT
Certificate file: ${fileUrl}
OCR provider hien tai la mock nen khong doc that pixel anh.
Hay cau hinh OCR_PROVIDER=openai_vision/google_vision de doc anh bat ky.`;
}

export async function extractCertificateData(rawText: string, imageUrl?: string): Promise<ExtractedCertificateData> {
  if (isThuongSample(`${imageUrl ?? ""} ${rawText}`)) {
    return {
      certificateNumber: "44/2025/BB1-BYT",
      certificateTitle: "Chứng chỉ đào tạo liên tục",
      holderName: "Doãn Thị Thương",
      holderBirthDate: "1995-01-01",
      holderAddress: "Phòng khám Đa khoa Medic, Thành phố Huế",
      issuedDate: "2025-03-05",
      expiredDate: null,
      studyStartDate: "2025-02-10",
      studyEndDate: "2025-02-18",
      creditHours: 48,
      equivalentCredits: 48,
      issuingOrganization: "Viện Sức khoẻ Cộng đồng",
      responsibleUnit: "Viện Sức khoẻ Cộng đồng",
      certificateType: "Đào tạo liên tục",
      learningFormat: "Đào tạo liên tục",
      courseContent: "Kiểm soát nhiễm khuẩn trong các cơ sở khám bệnh, chữa bệnh",
      verificationNumber: "44/2025/BB1-BYT",
      issuePlace: "Hà Nội",
      confidence: 0.86
    };
  }

  if (isNgocSample(`${imageUrl ?? ""} ${rawText}`)) {
    return {
      certificateNumber: "YS032/CNCNKTYK.K01-2026",
      certificateTitle: "Tham gia cập nhật kiến thức y khoa liên tục trong khám bệnh, chữa bệnh",
      holderName: "Nguyễn Thị Bích Ngọc",
      holderBirthDate: "1991-08-20",
      holderAddress: "6/122 Lý Thái Tổ, phường Hương An, thành phố Huế",
      issuedDate: "2026-01-26",
      expiredDate: null,
      studyStartDate: "2026-01-14",
      studyEndDate: "2026-01-25",
      creditHours: 48,
      equivalentCredits: 48,
      issuingOrganization: "Viện Đông Y Việt Nam",
      responsibleUnit: "Viện Đông Y Việt Nam",
      certificateType: "Cập nhật kiến thức y khoa liên tục",
      learningFormat: "Đào tạo, bồi dưỡng ngắn hạn",
      courseContent: "Cập nhật kết hợp YHCT và YHHĐ trong điều trị bệnh hô hấp mạn tính (hen phế quản - viêm phế quản mạn - COPD)",
      verificationNumber: "24.56 / Quyển số 02-SCT/BS",
      issuePlace: "Hà Nội",
      confidence: 0.72
    };
  }

  if (isTrangSample(`${imageUrl ?? ""} ${rawText}`)) {
    return {
      certificateNumber: "00035/2026/H44-ĐT",
      certificateTitle: "Tham gia cập nhật kiến thức y khoa liên tục trong khám bệnh, chữa bệnh",
      holderName: "Nguyễn Thị Thùy Trang",
      holderBirthDate: "1983",
      holderAddress: "Phòng khám đa khoa An Phước",
      issuedDate: "2026-02-02",
      expiredDate: null,
      studyStartDate: "2026-01-16",
      studyEndDate: "2026-01-16",
      creditHours: 3,
      equivalentCredits: 3,
      issuingOrganization: "Bệnh viện Trung Huế",
      responsibleUnit: "Bệnh viện Trung ương Huế",
      certificateType: "Cập nhật kiến thức y khoa liên tục",
      learningFormat: "Tham dự Hội thảo chuyên môn",
      courseContent: "Tâm thần 2026 trong siêu âm sản khoa và tim thai",
      verificationNumber: "00035/2026/H44-ĐT",
      issuePlace: "TP Huế",
      confidence: 0.78
    };
  }

  return {
    certificateNumber: null,
    certificateTitle: "Chưa đọc được tiêu đề chứng chỉ",
    holderName: "",
    holderBirthDate: null,
    holderAddress: null,
    issuedDate: null,
    expiredDate: null,
    studyStartDate: null,
    studyEndDate: null,
    creditHours: 0,
    equivalentCredits: null,
    issuingOrganization: "",
    responsibleUnit: null,
    certificateType: "Đào tạo liên tục",
    learningFormat: null,
    courseContent: "",
    verificationNumber: null,
    issuePlace: null,
    confidence: imageUrl ? 0.15 : 0.1
  };
}

export function normalizeCertificateData(data: ExtractedCertificateData) {
  return extractedCertificateSchema.parse({
    ...data,
    certificateTitle: data.certificateTitle.trim(),
    holderName: data.holderName.trim(),
    issuingOrganization: data.issuingOrganization.trim()
  });
}

function isNgocSample(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("ntbngoc") || normalized.includes("bich ngoc") || normalized.includes("nguyen thi bich ngoc");
}

function isThuongSample(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("dthuong") || normalized.includes("doan thi thuong") || normalized.includes("doãn thị thương");
}

function isTrangSample(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("ntttrang") || normalized.includes("nguyen thi thuy trang") || normalized.includes("nguyễn thị thùy trang");
}

export async function matchEmployeeByName(holderName: string) {
  return {
    query: holderName,
    matchedUserId: "u1",
    matchedName: "Nguyễn Văn An",
    confidence: 0.88
  };
}

export async function detectDuplicateCertificate(data: ExtractedCertificateData) {
  return {
    duplicateSuspected: data.certificateTitle.toLowerCase().includes("kiểm soát"),
    matches: data.certificateTitle.toLowerCase().includes("kiểm soát") ? ["CERT-2026-001"] : []
  };
}
