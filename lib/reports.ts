import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createHash, randomBytes } from "crypto";
import type { ReportArtifactKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestActor } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";

export async function buildComplianceReport(actor?: RequestActor) {
  const users = await prisma.user.findMany({
    where: tenantWhere(actor),
    include: {
      department: true,
      position: true,
      summaries: { include: { cycle: true }, orderBy: { updatedAt: "desc" }, take: 1 }
    },
    orderBy: { name: "asc" }
  });

  return users.map((employee) => {
    const summary = employee.summaries[0];
    const requiredHours = summary?.requiredHours ?? employee.position?.requiredHours ?? 48;
    const approvedHours = summary?.approvedHours ?? 0;
    return {
      name: employee.name,
      department: employee.department?.name ?? "",
      position: employee.position?.name ?? "",
      approvedHours,
      requiredHours,
      missingHours: Math.max(requiredHours - approvedHours, 0),
      compliant: approvedHours >= requiredHours,
      cycle: summary?.cycle.name ?? ""
    };
  });
}

export async function buildExpiringCertificateReport(actor?: RequestActor, days = 60) {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  const certificates = await prisma.certificate.findMany({
    where: {
      ...tenantWhere(actor),
      deletedAt: null,
      expiredDate: { gte: now, lte: until }
    },
    include: { holder: true, department: true, certificateType: true },
    orderBy: { expiredDate: "asc" }
  });

  return certificates.map((certificate) => ({
    code: certificate.certificateCode ?? certificate.id,
    title: certificate.title,
    holder: certificate.holder?.name ?? "",
    department: certificate.department?.name ?? "",
    type: certificate.certificateType?.name ?? "",
    expiredDate: certificate.expiredDate?.toISOString().slice(0, 10) ?? "",
    status: certificate.reviewStatus
  }));
}

export async function createReportArtifact(reportId: string, kind: ReportArtifactKind, rows: Array<Record<string, unknown>>) {
  const bytes = kind === "EXCEL" ? Buffer.from(toTsv(rows), "utf8") : Buffer.from(toPdfText(rows), "utf8");
  const extension = kind === "EXCEL" ? "xls" : "pdf";
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const fileName = `${reportId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const storageKey = `reports/${fileName}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);

  return prisma.reportArtifact.create({
    data: {
      reportId,
      kind,
      storageKey,
      url: `/uploads/reports/${fileName}`,
      sizeBytes: bytes.length,
      checksum
    }
  });
}

export function toTsv(rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return [headers.join("\t"), ...rows.map((row) => headers.map((header) => formatCell(row[header])).join("\t"))].join("\n");
}

function toPdfText(rows: Array<Record<string, unknown>>) {
  const text = toTsv(rows).replace(/[()\\]/g, "");
  return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length + 64} >>
stream
BT /F1 10 Tf 40 760 Td (${text.slice(0, 3000).replace(/\n/g, ") Tj T* (")}) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\t/g, " ").replace(/\n/g, " ");
}
