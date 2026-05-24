import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";
import { permissions } from "@/lib/permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";

const settingsSchema = z.record(z.string(), z.unknown());

export async function GET() {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const settings = await prisma.setting.findMany({
      where: tenantWhere(actor)
    });

    const data = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json({ data, storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "FETCH_SETTINGS_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const payload = settingsSchema.parse(await request.json());

    await Promise.all(
      Object.entries(payload).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: {
            ...tenantData(actor),
            key,
            value: value as Prisma.InputJsonValue
          }
        })
      )
    );

    return NextResponse.json({ success: true, storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "SAVE_SETTINGS_FAILED" }, { status: 400 });
  }
}
