import type { CertificateReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestActor } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";

export const certificateWorkflow: Record<CertificateReviewStatus, CertificateReviewStatus[]> = {
  PROCESSING: ["PENDING_CONFIRMATION", "OCR_FAILED", "MISSING_INFO", "DUPLICATE_SUSPECTED"],
  OCR_FAILED: ["PENDING_CONFIRMATION", "MISSING_INFO", "REJECTED"],
  PENDING_CONFIRMATION: ["PENDING_REVIEW", "MISSING_INFO", "DUPLICATE_SUSPECTED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "MISSING_INFO", "DUPLICATE_SUSPECTED", "EXCLUDED_FROM_CYCLE"],
  APPROVED: ["EXCLUDED_FROM_CYCLE", "PENDING_REVIEW"],
  REJECTED: ["PENDING_REVIEW"],
  MISSING_INFO: ["PENDING_CONFIRMATION", "PENDING_REVIEW", "REJECTED"],
  VALID: ["PENDING_REVIEW", "APPROVED", "EXCLUDED_FROM_CYCLE"],
  EXPIRING_SOON: ["PENDING_REVIEW", "APPROVED", "EXCLUDED_FROM_CYCLE"],
  EXPIRED: ["PENDING_REVIEW", "REJECTED", "EXCLUDED_FROM_CYCLE"],
  DUPLICATE_SUSPECTED: ["PENDING_REVIEW", "REJECTED", "EXCLUDED_FROM_CYCLE"],
  EXCLUDED_FROM_CYCLE: ["PENDING_REVIEW", "APPROVED"]
};

export async function transitionCertificateReview({
  certificateId,
  toStatus,
  actor,
  note,
  data
}: {
  certificateId: string;
  toStatus: CertificateReviewStatus;
  actor?: RequestActor;
  note?: string | null;
  data?: Record<string, unknown>;
}) {
  const before = await prisma.certificate.findFirst({ where: { id: certificateId, ...tenantWhere(actor) } });
  if (!before) throw new Error("CERTIFICATE_NOT_FOUND");

  const allowed = certificateWorkflow[before.reviewStatus] ?? [];
  if (before.reviewStatus !== toStatus && !allowed.includes(toStatus)) {
    throw new Error(`INVALID_CERTIFICATE_TRANSITION:${before.reviewStatus}->${toStatus}`);
  }

  const updated = await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      reviewStatus: toStatus,
      rejectionReason: typeof data?.rejectionReason === "string" ? data.rejectionReason : undefined,
      includeInCycle: toStatus === "EXCLUDED_FROM_CYCLE" ? false : undefined,
      approvedAt: toStatus === "APPROVED" ? new Date() : undefined,
      confirmedAt: toStatus === "PENDING_REVIEW" && before.reviewStatus === "PENDING_CONFIRMATION" ? new Date() : undefined
    }
  });

  await prisma.certificateReviewEvent.create({
    data: {
      certificateId,
      actorId: actor?.id,
      fromStatus: before.reviewStatus,
      toStatus,
      note,
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify({ ...updated, ...data }))
    }
  });

  return { before, updated };
}
