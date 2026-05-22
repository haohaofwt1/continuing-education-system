import type { Certificate, CertificateFile } from "@prisma/client";
import { detectDuplicateCertificate, extractCertificateData, extractTextFromImage, matchEmployeeByName, normalizeCertificateData } from "@/lib/ocr";
import { prisma } from "@/lib/prisma";

export async function enqueueCertificateOcr(certificate: Certificate, files: CertificateFile[] = []) {
  const provider = process.env.OCR_PROVIDER || "mock";
  const job = await prisma.ocrJob.create({
    data: {
      tenantId: certificate.tenantId,
      certificateId: certificate.id,
      provider,
      input: {
        fileUrls: files.map((file) => file.url),
        storageKeys: files.map((file) => file.storageKey).filter(Boolean)
      }
    }
  });

  await prisma.certificate.update({
    where: { id: certificate.id },
    data: { ocrStatus: "QUEUED", reviewStatus: "PROCESSING" }
  });

  return job;
}

export async function processOcrJob(jobId: string) {
  const job = await prisma.ocrJob.findUnique({
    where: { id: jobId },
    include: { certificate: { include: { files: true } } }
  });
  if (!job) throw new Error("OCR_JOB_NOT_FOUND");

  await prisma.ocrJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } }
  });

  try {
    const fileUrl = job.certificate.files[0]?.url ?? job.certificate.fileUrl ?? "/placeholder-certificate.svg";
    const rawText = await extractTextFromImage(fileUrl);
    const extracted = normalizeCertificateData(await extractCertificateData(rawText, fileUrl));
    const employeeMatch = await matchEmployeeByName(extracted.holderName);
    const duplicate = await detectDuplicateCertificate(extracted);
    const nextReviewStatus = duplicate.duplicateSuspected
      ? "DUPLICATE_SUSPECTED"
      : extracted.confidence >= 0.75
        ? "PENDING_CONFIRMATION"
        : "MISSING_INFO";

    await prisma.$transaction([
      prisma.certificateOcrResult.create({
        data: {
          certificateId: job.certificateId,
          provider: job.provider,
          rawText,
          extractedJson: { extracted, employeeMatch, duplicate },
          confidence: extracted.confidence,
          status: "SUCCEEDED"
        }
      }),
      prisma.certificate.update({
        where: { id: job.certificateId },
        data: {
          title: extracted.certificateTitle || undefined,
          issuingOrganization: extracted.issuingOrganization || undefined,
          issuedDate: parseDate(extracted.issuedDate),
          expiredDate: parseDate(extracted.expiredDate),
          creditHours: extracted.creditHours,
          certificateCode: extracted.certificateNumber || undefined,
          courseContent: extracted.courseContent || undefined,
          ocrStatus: "SUCCEEDED",
          reviewStatus: nextReviewStatus,
          confidence: extracted.confidence
        }
      }),
      prisma.ocrJob.update({
        where: { id: jobId },
        data: {
          status: "SUCCEEDED",
          result: { extracted, employeeMatch, duplicate },
          finishedAt: new Date()
        }
      })
    ]);

    return { rawText, extracted, employeeMatch, duplicate };
  } catch (error) {
    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: job.certificateId },
        data: { ocrStatus: "FAILED", reviewStatus: "OCR_FAILED" }
      }),
      prisma.ocrJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "OCR_FAILED", finishedAt: new Date() }
      })
    ]);
    throw error;
  }
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
