import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";
import { permissions } from "@/lib/permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";

const cycleSchema = z.object({
  name: z.string().min(1),
  startYear: z.number().int(),
  endYear: z.number().int(),
  requiredHours: z.number().int().nonnegative().default(48),
  isActive: z.boolean().default(true)
});

export async function GET() {
  try {
    const actor = await requirePermission(permissions.viewPersonnel);
    const cycle = await prisma.trainingCycle.findFirst({
      where: {
        ...tenantWhere(actor),
        isActive: true
      },
      orderBy: { startYear: "desc" }
    });

    if (!cycle) {
      return NextResponse.json({ data: null, storage: "database" });
    }

    return NextResponse.json({
      data: {
        id: cycle.id,
        name: cycle.name,
        startYear: cycle.startYear,
        endYear: cycle.endYear,
        requiredHours: cycle.requiredHours,
        isActive: cycle.isActive
      },
      storage: "database"
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "FETCH_CYCLE_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const payload = cycleSchema.parse(await request.json());

    // Deactivate other cycles if this one is active
    if (payload.isActive) {
      await prisma.trainingCycle.updateMany({
        where: {
          ...tenantWhere(actor),
          isActive: true
        },
        data: { isActive: false }
      });
    }

    const cycle = await prisma.trainingCycle.create({
      data: {
        ...tenantData(actor),
        ...payload
      }
    });

    return NextResponse.json({ data: cycle, storage: "database" }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "CREATE_CYCLE_FAILED" }, { status: 400 });
  }
}
