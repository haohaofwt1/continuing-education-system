import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { mapCertificate, toReviewStatus } from "@/lib/api-mappers";
import { syncApprovedCertificateCredit } from "@/lib/compliance";
import { enqueueCertificateOcr } from "@/lib/ocr-jobs";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isEmployeeActor, requirePermission } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";
import { certificateCycleAssessment } from "@/lib/training-rules";

const certificateSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional().nullable(),
  certificateNumber: z.string().optional().nullable(),
  title: z.string().min(1),
  holder: z.string().optional().nullable(),
  holderName: z.string().optional().nullable(),
  holderBirthDate: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  issuer: z.string().optional().nullable(),
  issuedDate: z.string().optional().nullable(),
  expiredDate: z.string().optional().nullable(),
  studyStartDate: z.string().optional().nullable(),
  studyEndDate: z.string().optional().nullable(),
  hours: z.number().optional().default(0),
  status: z.string().optional().nullable(),
  includeInCycle: z.boolean().optional(),
  isDuplicateSuspected: z.boolean().optional(),
  confidence: z.number().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  courseContent: z.string().optional().nullable()
});

const include = {
  holder: true,
  department: true,
  position: true,
  certificateType: true,
  trainingCycle: true
};

export async function GET(request: Request) {
  try {
    rateLimit(request, "certificates:list", 120);
    const actor = await requirePermission(permissions.viewCertificates);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const department = searchParams.get("department")?.trim();
    const status = searchParams.get("status")?.trim();
    const type = searchParams.get("type")?.trim();
    const certificates = await prisma.certificate.findMany({
      where: {
        ...tenantWhere(actor),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { certificateCode: { contains: q, mode: "insensitive" } },
                { issuingOrganization: { contains: q, mode: "insensitive" } },
                { holder: { name: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {}),
        ...(department ? { department: { name: department } } : {}),
        ...(type ? { certificateType: { name: type } } : {}),
        ...(status ? { reviewStatus: toReviewStatus(status) } : {}),
        ...(isEmployeeActor(actor) && actor.id ? { holderId: actor.id } : {})
      },
      include,
      orderBy: { createdAt: "desc" }
    });
    const data = certificates.map(mapCertificate);
    return NextResponse.json({ data, page: 1, pageSize: data.length, total: data.length, storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ data: [], error: "CERTIFICATES_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    rateLimit(request, "certificates:create", 30);
    const actor = await requirePermission(permissions.createCertificate);
    const payload = certificateSchema.parse(await request.json());
    const certificate = await upsertCertificate(payload, actor);
    const creditSync = await syncApprovedCertificateCredit(certificate.id, actor);
    const shouldQueueOcr = !payload.confidence && (payload.fileUrl || payload.thumbnail);
    const ocrJob = shouldQueueOcr ? await enqueueCertificateOcr(certificate) : null;
    await writeAuditLog({ actor, action: "certificate.create", entityType: "Certificate", entityId: certificate.id, after: payload, request });
    return NextResponse.json({ data: mapCertificate(certificate), ocrJobId: ocrJob?.id, creditSync, storage: "database" }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "CREATE_CERTIFICATE_FAILED", detail: error instanceof Error ? error.message : undefined }, { status: 400 });
  }
}

async function upsertCertificate(payload: z.infer<typeof certificateSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const [holder, department, position, certificateType, trainingCycle] = await Promise.all([
    isEmployeeActor(actor) && actor?.id ? findHolderById(actor.id) : findHolder(payload.holder),
    findOrCreateDepartment(payload.department),
    findOrCreatePosition(payload.position),
    findOrCreateCertificateType(payload.type),
    prisma.trainingCycle.findFirst({ where: { ...tenantWhere(actor), isActive: true }, orderBy: { startYear: "desc" } })
  ]);
  const certificateCode = payload.certificateNumber || payload.code || undefined;
  const identity = assessEmployeeCertificateIdentity(payload.holderName || payload.holder, payload.holderBirthDate, holder, actor);
  const cyclePrerequisite = assessEmployeeCyclePrerequisite(holder, actor);
  const duplicate = await detectDuplicateCertificate(certificateCode, payload, actor);
  const cycleAssessment = trainingCycle
    ? certificateCycleAssessment({
        issuedDate: payload.issuedDate,
        studyEndDate: payload.studyEndDate,
        hours: payload.hours
      }, trainingCycle)
    : { includeInCycle: true };
  const requiredFieldsMissing = !payload.title?.trim() || !payload.issuer?.trim() || !payload.issuedDate || !certificateCode || !Number(payload.hours || 0) || !payload.fileUrl || !identity.ok || !cyclePrerequisite.ok;
  const includeInCycle = cyclePrerequisite.ok ? payload.includeInCycle ?? isIssueDateInEmployeeCycle(payload.issuedDate, holder?.licenseIssuedAt) ?? cycleAssessment.includeInCycle : false;
  const calculatedStatus = requiredFieldsMissing
    ? "MISSING_INFO" as const
    : duplicate || payload.isDuplicateSuspected
      ? "DUPLICATE_SUSPECTED" as const
      : includeInCycle
        ? "APPROVED" as const
        : "EXCLUDED_FROM_CYCLE" as const;
  const reviewStatus = !identity.ok || !cyclePrerequisite.ok || requiredFieldsMissing ? "MISSING_INFO" as const : payload.status ? toReviewStatus(payload.status) : calculatedStatus;
  const storedCertificateCode = duplicate && !payload.id ? undefined : certificateCode;
  const notes = identity.reason || cyclePrerequisite.reason || (duplicate ? `Nghi trùng lặp với mã chứng chỉ ${certificateCode}. Tín chỉ không được cộng lần hai.` : null);
  const courseContent = [
    duplicate && certificateCode ? `Mã chứng chỉ OCR: ${certificateCode}` : "",
    payload.courseContent || ""
  ].filter(Boolean).join("\n") || null;
  const data = {
    ...tenantData(actor),
    title: payload.title,
    holderId: holder?.id,
    departmentId: holder?.departmentId ?? department?.id ?? undefined,
    positionId: holder?.positionId ?? position?.id ?? undefined,
    certificateTypeId: certificateType?.id,
    trainingCycleId: includeInCycle ? trainingCycle?.id : null,
    issuingOrganization: payload.issuer || null,
    issuedDate: parseDate(payload.issuedDate),
    expiredDate: parseDate(payload.expiredDate),
    creditHours: payload.hours,
    certificateCode: storedCertificateCode,
    courseContent,
    notes,
    fileUrl: payload.fileUrl || null,
    thumbnailUrl: payload.thumbnail || payload.fileUrl || "/placeholder-certificate.svg",
    reviewStatus,
    ocrStatus: payload.confidence ? "SUCCEEDED" as const : "QUEUED" as const,
    confidence: payload.confidence ?? null,
    includeInCycle: reviewStatus === "APPROVED"
  };

  if (payload.id) {
    return prisma.certificate.upsert({
      where: { id: payload.id },
      update: data,
      create: { id: payload.id, ...data },
      include
    });
  }

  if (certificateCode && !duplicate) {
    return prisma.certificate.upsert({
      where: { certificateCode },
      update: data,
      create: data,
      include
    });
  }

  return prisma.certificate.create({ data, include });
}

async function detectDuplicateCertificate(certificateCode: string | undefined, payload: z.infer<typeof certificateSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  if (!certificateCode && !payload.title) return false;
  const existing = await prisma.certificate.findFirst({
    where: {
      ...tenantWhere(actor),
      ...(payload.id ? { NOT: { id: payload.id } } : {}),
      OR: [
        ...(certificateCode ? [{ certificateCode }] : []),
        {
          title: { equals: payload.title, mode: "insensitive" },
          holderId: isEmployeeActor(actor) && actor.id ? actor.id : undefined,
          issuedDate: parseDate(payload.issuedDate)
        }
      ]
    }
  });
  return Boolean(existing);
}

function assessEmployeeCertificateIdentity(
  certificateHolderName: string | null | undefined,
  certificateHolderBirthDate: string | null | undefined,
  holder: Awaited<ReturnType<typeof findHolderById>> | Awaited<ReturnType<typeof findHolder>>,
  actor: Awaited<ReturnType<typeof requirePermission>>
) {
  if (!isEmployeeActor(actor)) return { ok: true, reason: "" };
  const expectedName = holder?.name?.trim();
  const extractedName = certificateHolderName?.trim();
  if (!expectedName) return { ok: false, reason: "Hồ sơ nhân viên chưa có tên để đối chiếu người trên chứng chỉ." };
  if (!extractedName) {
    return {
      ok: false,
      reason: "Chưa đọc được tên người trên chứng chỉ, nên tín chỉ chưa được tính. Vui lòng tải ảnh rõ hơn hoặc để admin kiểm tra dữ liệu OCR."
    };
  }
  if (normalizePersonName(extractedName) !== normalizePersonName(expectedName)) {
    return {
      ok: false,
      reason: `Người trên chứng chỉ (${extractedName}) không khớp hồ sơ đang đăng nhập (${expectedName}), nên tín chỉ chưa được tính.`
    };
  }
  return {
    ok: true,
    reason: certificateHolderBirthDate?.trim()
      ? `Đã đối chiếu tên người trên chứng chỉ với hồ sơ. Ngày sinh OCR: ${certificateHolderBirthDate.trim()}.`
      : ""
  };
}

function assessEmployeeCyclePrerequisite(
  holder: Awaited<ReturnType<typeof findHolderById>> | Awaited<ReturnType<typeof findHolder>>,
  actor: Awaited<ReturnType<typeof requirePermission>>
) {
  if (!isEmployeeActor(actor)) return { ok: true, reason: "" };
  if (!holder?.licenseIssuedAt) {
    return {
      ok: false,
      reason: "Hồ sơ chưa có ngày cấp CCHN/GPLH nên hệ thống chưa thể xác định chu kỳ 5 năm và chưa cộng tín chỉ."
    };
  }
  return { ok: true, reason: "" };
}

function normalizePersonName(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findHolder(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.user.findFirst({ where: { name: { equals: value, mode: "insensitive" } } });
}

async function findHolderById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

async function findOrCreateDepartment(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.department.upsert({ where: { name: value }, update: {}, create: { name: value } });
}

async function findOrCreatePosition(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.position.upsert({ where: { name: value }, update: {}, create: { name: value } });
}

async function findOrCreateCertificateType(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.certificateType.upsert({ where: { name: value }, update: {}, create: { name: value } });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isIssueDateInEmployeeCycle(issueDate?: string | null, licenseIssuedAt?: Date | null) {
  const issued = parseDate(issueDate);
  if (!issued || !licenseIssuedAt) return null;
  const start = new Date(licenseIssuedAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 5);
  end.setDate(end.getDate() - 1);
  return issued >= start && issued <= end;
}
