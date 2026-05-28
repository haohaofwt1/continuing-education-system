import type { Certificate, CompliancePolicy, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestActor } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";
import { buildIndividualComplianceCycle } from "@/lib/training-rules";

type CertificateForCredit = Certificate & {
  holder?: User | null;
};

const defaultPolicy = {
  code: "CME_120H_5Y",
  name: "CME 120 tiết / 5 năm",
  cycleYears: 5,
  requiredHours: 120,
  annualMinimumHours: 12,
  requiresLicense: true,
  description: "Chính sách đào tạo liên tục mặc định: 120 tiết trong 5 năm, tối thiểu 12 tiết mỗi năm."
};

export async function syncApprovedCertificateCredit(certificateId: string, actor?: RequestActor) {
  const certificate = await prisma.certificate.findFirst({
    where: { id: certificateId, ...tenantWhere(actor), deletedAt: null },
    include: { holder: true }
  });

  if (!certificate) throw new Error("CERTIFICATE_NOT_FOUND");

  if (certificate.reviewStatus !== "APPROVED" || !certificate.includeInCycle || !certificate.holderId) {
    await removeCreditRecordsForCertificate(certificate.id, actor);
    return { synced: false, reason: "CERTIFICATE_NOT_APPROVED_OR_NOT_COUNTED" };
  }

  const creditDate = getCreditDate(certificate);
  if (!creditDate) {
    await removeCreditRecordsForCertificate(certificate.id, actor);
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        reviewStatus: "MISSING_INFO",
        notes: appendNote(certificate.notes, "Thiếu ngày tín chỉ/ngày cấp nên chưa thể cộng vào chu kỳ.")
      }
    });
    return { synced: false, reason: "MISSING_CREDIT_DATE" };
  }

  const policy = await resolvePolicy(certificate.holder, actor);
  const cycle = await findOrCreateEmployeeCycle(certificate, policy, creditDate, actor);
  const includedInCycle = creditDate >= cycle.startDate && creditDate <= cycle.endDate;

  await prisma.creditRecord.upsert({
    where: {
      certificateId_employeeId_creditDate: {
        certificateId: certificate.id,
        employeeId: certificate.holderId,
        creditDate
      }
    },
    update: {
      ...tenantData(actor),
      cycleId: includedInCycle ? cycle.id : null,
      hours: certificate.creditHours,
      includedInCycle,
      excludeReason: includedInCycle ? null : "Ngày tín chỉ không nằm trong chu kỳ cá nhân.",
      approvedById: actor?.id,
      approvedAt: new Date()
    },
    create: {
      ...tenantData(actor),
      certificateId: certificate.id,
      employeeId: certificate.holderId,
      cycleId: includedInCycle ? cycle.id : null,
      creditDate,
      hours: certificate.creditHours,
      includedInCycle,
      excludeReason: includedInCycle ? null : "Ngày tín chỉ không nằm trong chu kỳ cá nhân.",
      approvedById: actor?.id,
      approvedAt: new Date()
    }
  });

  await recalculateEmployeeCycle(cycle.id);
  await syncLegacyTrainingSummary(certificate.holderId, cycle.id, certificate.trainingCycleId);

  return { synced: true, cycleId: cycle.id, includedInCycle };
}

export async function removeCreditRecordsForCertificate(certificateId: string, actor?: RequestActor) {
  const existing = await prisma.creditRecord.findMany({
    where: { certificateId, ...tenantWhere(actor) },
    select: { id: true, cycleId: true, employeeId: true }
  });
  await prisma.creditRecord.deleteMany({ where: { certificateId, ...tenantWhere(actor) } });
  await Promise.all(Array.from(new Set(existing.map((item) => item.cycleId).filter(Boolean) as string[])).map(recalculateEmployeeCycle));
  return existing.length;
}

async function resolvePolicy(employee: User | null | undefined, actor?: RequestActor): Promise<CompliancePolicy> {
  const position = employee?.positionId
    ? await prisma.position.findUnique({ where: { id: employee.positionId }, include: { compliancePolicy: true } })
    : null;
  if (position?.compliancePolicy?.isActive) return position.compliancePolicy;

  const existing = await prisma.compliancePolicy.findFirst({
    where: {
      ...tenantWhere(actor),
      OR: [{ isDefault: true }, { code: defaultPolicy.code }]
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
  if (existing) return existing;

  return prisma.compliancePolicy.create({
    data: {
      ...tenantData(actor),
      ...defaultPolicy,
      isDefault: true,
      isActive: true
    }
  });
}

async function findOrCreateEmployeeCycle(
  certificate: CertificateForCredit,
  policy: CompliancePolicy,
  creditDate: Date,
  actor?: RequestActor
) {
  const holder = certificate.holder;
  if (!holder || !certificate.holderId) throw new Error("CERTIFICATE_HOLDER_REQUIRED");

  const cycleWindow = buildIndividualComplianceCycle(
    holder.licenseIssuedAt?.toISOString().slice(0, 10) || null,
    {
      cycleYears: policy.cycleYears,
      requiredHours: policy.requiredHours,
      annualMinimumHours: policy.annualMinimumHours
    },
    creditDate
  );

  const startDate = parseDate(cycleWindow.startDate);
  const endDate = parseDate(cycleWindow.endDate);
  const existing = await prisma.employeeComplianceCycle.findFirst({
    where: {
      ...tenantWhere(actor),
      employeeId: certificate.holderId,
      policyId: policy.id,
      startDate,
      endDate
    }
  });
  if (existing) return existing;

  return prisma.employeeComplianceCycle.create({
    data: {
      ...tenantData(actor),
      employeeId: certificate.holderId,
      policyId: policy.id,
      startDate,
      endDate,
      requiredHours: policy.requiredHours,
      annualMinimumHours: policy.annualMinimumHours,
      approvedHours: 0,
      missingHours: policy.requiredHours,
      status: "ACTIVE"
    }
  });
}

async function recalculateEmployeeCycle(cycleId: string) {
  const cycle = await prisma.employeeComplianceCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return null;

  const aggregate = await prisma.creditRecord.aggregate({
    where: { cycleId, includedInCycle: true },
    _sum: { hours: true }
  });
  const approvedHours = aggregate._sum.hours ?? 0;
  const missingHours = Math.max(cycle.requiredHours - approvedHours, 0);
  return prisma.employeeComplianceCycle.update({
    where: { id: cycleId },
    data: {
      approvedHours,
      missingHours,
      status: missingHours <= 0 ? "COMPLETED" : new Date() > cycle.endDate ? "OVERDUE" : "ACTIVE"
    }
  });
}

async function syncLegacyTrainingSummary(employeeId: string, employeeCycleId: string, trainingCycleId?: string | null) {
  const employeeCycle = await prisma.employeeComplianceCycle.findUnique({ where: { id: employeeCycleId } });
  if (!employeeCycle || !trainingCycleId) return;
  await prisma.trainingSummary.upsert({
    where: { userId_cycleId: { userId: employeeId, cycleId: trainingCycleId } },
    update: {
      approvedHours: employeeCycle.approvedHours,
      requiredHours: employeeCycle.requiredHours,
      missingHours: employeeCycle.missingHours,
      compliant: employeeCycle.missingHours <= 0
    },
    create: {
      userId: employeeId,
      cycleId: trainingCycleId,
      approvedHours: employeeCycle.approvedHours,
      requiredHours: employeeCycle.requiredHours,
      missingHours: employeeCycle.missingHours,
      compliant: employeeCycle.missingHours <= 0
    }
  });
}

function getCreditDate(certificate: Certificate) {
  return certificate.issuedDate ?? null;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function appendNote(current: string | null, note: string) {
  return current ? `${current}\n${note}` : note;
}
