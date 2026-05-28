import { NextResponse } from "next/server";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isEmployeeActor, requirePermission } from "@/lib/server-permissions";
import { tenantWhere } from "@/lib/tenant";
import { uploadCertificateFiles } from "@/lib/upload";

export async function POST(request: Request) {
  try {
    rateLimit(request, "upload:certificates", 20);
    const actor = await requirePermission(permissions.createCertificate);
    const formData = await request.formData();
    const certificateId = String(formData.get("certificateId") ?? "");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const uploaded = await uploadCertificateFiles(files);

    if (certificateId) {
      const certificate = await prisma.certificate.findFirst({
        where: {
          id: certificateId,
          deletedAt: null,
          ...tenantWhere(actor),
          ...(isEmployeeActor(actor) && actor.id ? { holderId: actor.id } : {})
        }
      });
      if (!certificate) return NextResponse.json({ error: "CERTIFICATE_NOT_FOUND" }, { status: 404 });
      await prisma.certificateFile.createMany({
        data: uploaded.map((file) => ({
          certificateId,
          fileName: file.fileName,
          storageKey: file.storageKey,
          fileKind: file.mimeType === "application/pdf" ? "PDF" : "IMAGE",
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl,
          checksum: file.checksum
        }))
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "UPLOAD_FAILED" }, { status: 400 });
  }
}
