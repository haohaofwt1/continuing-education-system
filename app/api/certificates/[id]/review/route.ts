import { CertificateReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { transitionCertificateReview } from "@/lib/certificate-workflow";
import { permissions } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";

const reviewSchema = z.object({
  status: z.nativeEnum(CertificateReviewStatus),
  note: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(request, "certificates:review", 60);
    const payload = reviewSchema.parse(await request.json());
    const permission = payload.status === "REJECTED" ? permissions.rejectCertificate : permissions.approveCertificate;
    const actor = await requirePermission(permission);
    const { id } = await params;
    const { before, updated } = await transitionCertificateReview({
      certificateId: id,
      toStatus: payload.status,
      actor,
      note: payload.note,
      data: { rejectionReason: payload.rejectionReason }
    });

    await writeAuditLog({
      actor,
      action: `certificate.review.${payload.status.toLowerCase()}`,
      entityType: "Certificate",
      entityId: id,
      before,
      after: updated,
      request
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "REVIEW_CERTIFICATE_FAILED" }, { status: 400 });
  }
}
