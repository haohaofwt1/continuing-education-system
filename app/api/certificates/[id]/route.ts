import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { mapCertificate, toReviewStatus } from "@/lib/api-mappers";
import { removeCreditRecordsForCertificate, syncApprovedCertificateCredit } from "@/lib/compliance";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";
import { certificateCycleAssessment } from "@/lib/training-rules";

const patchSchema = z.object({
  code: z.string().optional().nullable(),
  certificateNumber: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  holder: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  issuer: z.string().optional().nullable(),
  issuedDate: z.string().optional().nullable(),
  expiredDate: z.string().optional().nullable(),
  studyStartDate: z.string().optional().nullable(),
  studyEndDate: z.string().optional().nullable(),
  hours: z.number().optional(),
  status: z.string().optional().nullable(),
  includeInCycle: z.boolean().optional(),
  confidence: z.number().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  courseContent: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});

const include = { holder: true, department: true, position: true, certificateType: true };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(request, "certificates:update", 60);
    const actor = await requirePermission(permissions.createCertificate);
    const { id } = await params;
    const payload = patchSchema.parse(await request.json());
    const before = await prisma.certificate.findFirst({ where: { id, ...tenantWhere(actor) }, include });
    if (!before) return NextResponse.json({ error: "CERTIFICATE_NOT_FOUND" }, { status: 404 });

    const [holder, department, position, certificateType] = await Promise.all([
      payload.holder === undefined ? before.holder : findHolder(payload.holder),
      payload.department === undefined ? before.department : findOrCreateDepartment(payload.department),
      payload.position === undefined ? before.position : findOrCreatePosition(payload.position),
      payload.type === undefined ? before.certificateType : findOrCreateCertificateType(payload.type)
    ]);
    const activeCycle = await prisma.trainingCycle.findFirst({ where: { ...tenantWhere(actor), isActive: true }, orderBy: { startYear: "desc" } });
    const issuedDate = payload.issuedDate === undefined ? before.issuedDate?.toISOString().slice(0, 10) : payload.issuedDate;
    const cycleAssessment = activeCycle
      ? certificateCycleAssessment({
          issuedDate,
          studyEndDate: payload.studyEndDate,
          hours: payload.hours ?? before.creditHours
        }, activeCycle)
      : { includeInCycle: before.includeInCycle };
    const includeInCycle = payload.includeInCycle ?? cycleAssessment.includeInCycle;
    const reviewStatus = includeInCycle ? (payload.status ? toReviewStatus(payload.status) : undefined) : "EXCLUDED_FROM_CYCLE";
    const updated = await prisma.certificate.update({
      where: { id },
      data: {
        title: payload.title,
        holderId: holder?.id,
        departmentId: department?.id ?? holder?.departmentId,
        positionId: position?.id ?? holder?.positionId,
        certificateTypeId: certificateType?.id,
        issuingOrganization: payload.issuer,
        issuedDate: payload.issuedDate === undefined ? undefined : parseDate(payload.issuedDate),
        expiredDate: payload.expiredDate === undefined ? undefined : parseDate(payload.expiredDate),
        creditHours: payload.hours,
        certificateCode: payload.certificateNumber || payload.code || undefined,
        courseContent: payload.courseContent,
        fileUrl: payload.fileUrl,
        thumbnailUrl: payload.thumbnail || payload.fileUrl || undefined,
        trainingCycleId: includeInCycle ? activeCycle?.id : null,
        includeInCycle,
        reviewStatus,
        confidence: payload.confidence,
        rejectionReason: payload.rejectionReason,
        approvedAt: reviewStatus === "APPROVED" ? new Date() : undefined
      },
      include
    });
    const creditSync = updated.reviewStatus === "APPROVED"
      ? await syncApprovedCertificateCredit(updated.id, actor)
      : await removeCreditRecordsForCertificate(updated.id, actor).then((removed) => ({ synced: false, removed }));
    await writeAuditLog({ actor, action: "certificate.update", entityType: "Certificate", entityId: id, before, after: payload, request });
    return NextResponse.json({ data: mapCertificate(updated), creditSync, storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "UPDATE_CERTIFICATE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(request, "certificates:delete", 20);
    const actor = await requirePermission(permissions.deleteCertificate);
    const { id } = await params;
    const before = await prisma.certificate.findFirst({ where: { id, ...tenantWhere(actor) } });
    if (!before) return NextResponse.json({ ok: true });
    await prisma.certificate.delete({ where: { id } });
    await writeAuditLog({ actor, action: "certificate.delete", entityType: "Certificate", entityId: id, before, request });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "DELETE_CERTIFICATE_FAILED" }, { status: 400 });
  }
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
