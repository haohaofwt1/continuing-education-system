import { NextResponse } from "next/server";
import { mapCertificate } from "@/lib/api-mappers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        department: true,
        position: true,
        role: true,
        summaries: { include: { cycle: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        complianceCycles: { include: { policy: true }, orderBy: { endDate: "desc" }, take: 1 }
      }
    });

    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    const certificates = await prisma.certificate.findMany({
      where: { holderId: user.id, tenantId: user.tenantId, deletedAt: null },
      include: {
        holder: true,
        department: true,
        position: true,
        certificateType: true,
        trainingCycle: true
      },
      orderBy: { createdAt: "desc" }
    });

    const summary = user.summaries[0];
    const licenseCycle = getLicenseCycle(user.licenseIssuedAt);
    const activeCycle = user.complianceCycles[0];
    const requiredHours = activeCycle?.requiredHours ?? Math.max(user.position?.requiredHours ?? summary?.requiredHours ?? 120, 120);
    const approvedCertificates = certificates.filter((certificate) => {
      if (certificate.reviewStatus !== "APPROVED") return false;
      if (!licenseCycle || !certificate.issuedDate) return false;
      return certificate.issuedDate >= licenseCycle.startDate && certificate.issuedDate <= licenseCycle.endDate;
    });
    const approvedHours = licenseCycle ? approvedCertificates.reduce((sum, certificate) => sum + certificate.creditHours, 0) : 0;
    const missingHours = Math.max(requiredHours - approvedHours, 0);
    const now = new Date();
    const cycleEnd = licenseCycle?.endDate ?? null;
    const daysRemaining = cycleEnd ? Math.max(0, Math.ceil((cycleEnd.getTime() - now.getTime()) / 86_400_000)) : null;
    const pendingCertificates = certificates.filter((certificate) => ["MISSING_INFO", "PENDING_CONFIRMATION", "PROCESSING"].includes(certificate.reviewStatus));
    const rejectedCertificates = certificates.filter((certificate) => ["REJECTED", "EXCLUDED_FROM_CYCLE", "DUPLICATE_SUSPECTED"].includes(certificate.reviewStatus));
    const expiringCertificates = certificates.filter((certificate) => {
      if (!certificate.expiredDate) return false;
      const days = Math.ceil((certificate.expiredDate.getTime() - now.getTime()) / 86_400_000);
      return days >= 0 && days <= 60;
    });

    const yearlyHours = approvedCertificates.reduce<Record<string, number>>((acc, certificate) => {
      const year = certificate.issuedDate?.getFullYear() ?? certificate.createdAt.getFullYear();
      acc[String(year)] = (acc[String(year)] ?? 0) + certificate.creditHours;
      return acc;
    }, {});

    return NextResponse.json({
      data: {
        employee: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          department: user.department?.name ?? "",
          position: user.position?.name ?? "",
          role: user.role?.name ?? "",
          licenseNumber: user.licenseNumber ?? "",
          licenseIssuedAt: formatDate(user.licenseIssuedAt)
        },
        compliance: {
          cycleLabel: licenseCycle
            ? `${licenseCycle.startDate.getFullYear()} - ${licenseCycle.endDate.getFullYear()}`
            : "Chưa cấu hình",
          requiredHours,
          approvedHours,
          missingHours,
          completionRate: requiredHours ? Math.min(100, Math.round((approvedHours / requiredHours) * 100)) : 0,
          daysRemaining,
          status: !licenseCycle ? "Chưa cấu hình chu kỳ" : missingHours <= 0 ? "Đạt yêu cầu" : "Cần bổ sung",
          risk: !licenseCycle ? "Chưa xác định" : missingHours <= 0 ? "Thấp" : daysRemaining !== null && daysRemaining < 180 ? "Cao" : "Vàng",
          yearlyHours
        },
        counts: {
          total: certificates.length,
          approved: approvedCertificates.length,
          pending: pendingCertificates.length,
          rejected: rejectedCertificates.length,
          expiring: expiringCertificates.length
        },
        certificates: certificates.map(mapCertificate)
      }
    });
  } catch (error) {
    console.error("Portal overview database unavailable", error);
    return NextResponse.json({ error: "PORTAL_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

function formatDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function getLicenseCycle(issuedAt?: Date | null) {
  if (!issuedAt) return null;
  const startDate = new Date(issuedAt);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 5);
  endDate.setDate(endDate.getDate() - 1);
  return { startDate, endDate };
}
