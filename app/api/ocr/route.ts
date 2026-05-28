import { NextResponse } from "next/server";
import { detectDuplicateCertificate, extractCertificateData, extractTextFromImage, matchEmployeeByName, normalizeCertificateData } from "@/lib/ocr";
import { enqueueCertificateOcr, processOcrJob } from "@/lib/ocr-jobs";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    rateLimit(request, "ocr", 30);
    const actor = await requirePermission(permissions.createCertificate);
    const body = (await request.json()) as { fileUrl?: string; fileName?: string; certificateId?: string; jobId?: string; processNow?: boolean };

    if (body.jobId) {
      const job = await prisma.ocrJob.findFirst({ where: { id: body.jobId, ...tenantWhere(actor) } });
      if (!job) return NextResponse.json({ error: "OCR_JOB_NOT_FOUND" }, { status: 404 });
      const result = await processOcrJob(body.jobId);
      return NextResponse.json(result);
    }

    if (body.certificateId) {
      const certificate = await prisma.certificate.findFirst({
        where: { id: body.certificateId, ...tenantWhere(actor), deletedAt: null },
        include: { files: true }
      });
      if (!certificate) return NextResponse.json({ error: "CERTIFICATE_NOT_FOUND" }, { status: 404 });
      const job = await enqueueCertificateOcr(certificate, certificate.files);
      if (body.processNow) {
        const result = await processOcrJob(job.id);
        return NextResponse.json({ jobId: job.id, ...result });
      }
      return NextResponse.json({ jobId: job.id, status: job.status });
    }

    const fileContext = body.fileUrl || body.fileName || "/placeholder-certificate.svg";
    const rawText = await extractTextFromImage(fileContext);
    const extracted = normalizeCertificateData(await extractCertificateData(rawText, fileContext));
    const employeeMatch = await matchEmployeeByName(extracted.holderName);
    const duplicate = await detectDuplicateCertificate(extracted);

    return NextResponse.json({
      rawText,
      extracted,
      employeeMatch,
      duplicate
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "OCR_FAILED" }, { status: 400 });
  }
}
