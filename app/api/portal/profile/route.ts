import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  licenseNumber: z.string().min(1, "LICENSE_NUMBER_REQUIRED"),
  licenseIssuedAt: z.string().min(1, "LICENSE_ISSUED_AT_REQUIRED"),
  avatarUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const payload = profileSchema.parse(await request.json());
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: payload.name,
        phone: payload.phone || null,
        licenseNumber: payload.licenseNumber || null,
        licenseIssuedAt: parseDate(payload.licenseIssuedAt),
        avatarUrl: payload.avatarUrl || null,
        notes: payload.notes || null
      }
    });
    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        licenseNumber: updated.licenseNumber,
        licenseIssuedAt: updated.licenseIssuedAt?.toISOString().slice(0, 10) ?? "",
        avatarUrl: updated.avatarUrl,
        notes: updated.notes
      }
    });
  } catch {
    return NextResponse.json({ error: "UPDATE_PROFILE_FAILED" }, { status: 400 });
  }
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
