import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { mapCertificate, toReviewStatus } from "@/lib/api-mappers";
import { syncApprovedCertificateCredit } from "@/lib/compliance";
import { enqueueCertificateOcr } from "@/lib/ocr-jobs";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";
import { certificateCycleAssessment } from "@/lib/training-rules";

const certificateSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional().nullable(),
  certificateNumber: z.string().optional().nullable(),
  title: z.string().min(1),
  holder: z.string().optional().nullable(),
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
  confidence: z.number().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  courseContent: z.string().optional().nullable()
});

const include = {
  holder: true,
  department: true,
  position: true,
  certificateType: true
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
        ...(status ? { reviewStatus: toReviewStatus(status) } : {})
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
    const creditSync = certificate.reviewStatus === "APPROVED" ? await syncApprovedCertificateCredit(certificate.id, actor) : null;
    const shouldQueueOcr = !payload.confidence && (payload.fileUrl || payload.thumbnail);
    const ocrJob = shouldQueueOcr ? await enqueueCertificateOcr(certificate) : null;
    await writeAuditLog({ actor, action: "certificate.create", entityType: "Certificate", entityId: certificate.id, after: payload, request });
    return NextResponse.json({ data: mapCertificate(certificate), ocrJobId: ocrJob?.id, creditSync, storage: "database" }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "CREATE_CERTIFICATE_FAILED" }, { status: 400 });
  }
}

async function upsertCertificate(payload: z.infer<typeof certificateSchema>, actor?: Awaited<ReturnType<typeof requirePermission>>) {
  const [holder, department, position, certificateType, trainingCycle] = await Promise.all([
    findHolder(payload.holder),
    findOrCreateDepartment(payload.department),
    findOrCreatePosition(payload.position),
    findOrCreateCertificateType(payload.type),
    prisma.trainingCycle.findFirst({ where: { ...tenantWhere(actor), isActive: true }, orderBy: { startYear: "desc" } })
  ]);
  const certificateCode = payload.certificateNumber || payload.code || undefined;
  const cycleAssessment = trainingCycle
    ? certificateCycleAssessment({
        issuedDate: payload.issuedDate,
        studyEndDate: payload.studyEndDate,
        hours: payload.hours
      }, trainingCycle)
    : { includeInCycle: true };
  const includeInCycle = payload.includeInCycle ?? cycleAssessment.includeInCycle;
  const reviewStatus = includeInCycle ? toReviewStatus(payload.status || undefined) : "EXCLUDED_FROM_CYCLE" as const;
  const data = {
    ...tenantData(actor),
    title: payload.title,
    holderId: holder?.id,
    departmentId: department?.id ?? holder?.departmentId ?? undefined,
    positionId: position?.id ?? holder?.positionId ?? undefined,
    certificateTypeId: certificateType?.id,
    trainingCycleId: includeInCycle ? trainingCycle?.id : null,
    issuingOrganization: payload.issuer || null,
    issuedDate: parseDate(payload.issuedDate),
    expiredDate: parseDate(payload.expiredDate),
    creditHours: payload.hours,
    certificateCode,
    courseContent: payload.courseContent || null,
    fileUrl: payload.fileUrl || null,
    thumbnailUrl: payload.thumbnail || payload.fileUrl || "/placeholder-certificate.svg",
    reviewStatus,
    ocrStatus: payload.confidence ? "SUCCEEDED" as const : "QUEUED" as const,
    confidence: payload.confidence ?? null,
    includeInCycle
  };

  if (payload.id) {
    return prisma.certificate.upsert({
      where: { id: payload.id },
      update: data,
      create: { id: payload.id, ...data },
      include
    });
  }

  if (certificateCode) {
    return prisma.certificate.upsert({
      where: { certificateCode },
      update: data,
      create: data,
      include
    });
  }

  return prisma.certificate.create({ data, include });
}

async function findHolder(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.user.findFirst({ where: { name: { equals: value, mode: "insensitive" } } });
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
