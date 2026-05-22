import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { buildComplianceReport, buildExpiringCertificateReport, createReportArtifact } from "@/lib/reports";
import { requirePermission } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";

const createReportSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["compliance", "expiring"]).default("compliance"),
  filters: z.record(z.unknown()).default({}),
  exportKinds: z.array(z.enum(["EXCEL", "PDF"])).default(["EXCEL"])
});

export async function GET(request: Request) {
  try {
    rateLimit(request, "reports:list", 60);
    const actor = await requirePermission(permissions.viewUnitReports);
    const type = new URL(request.url).searchParams.get("type") ?? "compliance";
    const rows = type === "expiring" ? await buildExpiringCertificateReport(actor) : await buildComplianceReport(actor);
    const reports = await prisma.report.findMany({
      where: { ...tenantWhere(actor), type },
      include: { shares: true, artifacts: true },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return NextResponse.json({ type, rows, reports });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "REPORTS_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    rateLimit(request, "reports:create", 30);
    const actor = await requirePermission(permissions.createReports);
    const payload = createReportSchema.parse(await request.json());
    const rows = payload.type === "expiring" ? await buildExpiringCertificateReport(actor) : await buildComplianceReport(actor);
    const report = await prisma.report.create({
      data: {
        ...tenantData(actor),
        name: payload.name,
        type: payload.type,
        filters: payload.filters as Prisma.InputJsonValue,
        createdById: actor.id
      }
    });
    const artifacts = await Promise.all(payload.exportKinds.map((kind) => createReportArtifact(report.id, kind, rows)));
    await writeAuditLog({ actor, action: "report.create", entityType: "Report", entityId: report.id, after: { ...payload, artifacts }, request });
    return NextResponse.json({ data: { ...report, artifacts }, rows }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "CREATE_REPORT_FAILED" }, { status: 400 });
  }
}
