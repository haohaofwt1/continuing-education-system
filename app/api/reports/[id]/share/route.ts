import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";

const shareSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(request, "reports:share", 20);
    const actor = await requirePermission(permissions.shareReports);
    const payload = shareSchema.parse(await request.json());
    const { id } = await params;
    const report = await prisma.report.findFirst({ where: { id, ...tenantWhere(actor) } });
    if (!report) return NextResponse.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });

    const token = randomBytes(24).toString("hex");
    const share = await prisma.sharedReport.create({
      data: {
        reportId: id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      }
    });

    await writeAuditLog({ actor, action: "report.share", entityType: "Report", entityId: id, after: { shareId: share.id, expiresAt: share.expiresAt }, request });
    return NextResponse.json({ token, url: `/reports/shared/${token}`, expiresAt: share.expiresAt });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "SHARE_REPORT_FAILED" }, { status: 400 });
  }
}
