import { NextResponse } from "next/server";
import { z } from "zod";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";

const catalogSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["Khoa/phòng", "Chức danh"]),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  requiredHours: z.number().optional().nullable(),
  annualMinimumHours: z.number().optional().nullable(),
  requiresLicense: z.boolean().optional().nullable()
});

export async function GET() {
  try {
    const actor = await requirePermission(permissions.manageCatalog);
    const [departments, positions] = await Promise.all([
      prisma.department.findMany({ where: tenantWhere(actor), orderBy: { name: "asc" } }),
      prisma.position.findMany({ where: tenantWhere(actor), orderBy: { name: "asc" } })
    ]);

    return NextResponse.json({
      data: [
        ...departments.map((item) => ({
          id: item.id,
          kind: "Khoa/phòng",
          name: item.name,
          code: item.code ?? "",
          status: "Hoạt động",
          note: item.description ?? "",
          requiredHours: 0,
          annualMinimumHours: 0,
          requiresLicense: true
        })),
        ...positions.map((item) => ({
          id: item.id,
          kind: "Chức danh",
          name: item.name,
          code: "",
          status: "Hoạt động",
          note: "",
          policyName: item.requiredHours ? `CME ${item.requiredHours} tiết / 5 năm` : "",
          requiredHours: item.requiredHours ?? 120,
          annualMinimumHours: 12,
          requiresLicense: true
        }))
      ]
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ data: [], error: "CATALOG_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(permissions.manageCatalog);
    const payload = catalogSchema.parse(await request.json());
    const data = await saveCatalogItem(payload, actor);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "SAVE_CATALOG_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(permissions.manageCatalog);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const kind = searchParams.get("kind");
    if (!id || !["Khoa/phòng", "Chức danh"].includes(kind ?? "")) {
      return NextResponse.json({ error: "INVALID_CATALOG_ITEM" }, { status: 400 });
    }

    if (kind === "Khoa/phòng") {
      const item = await prisma.department.findFirst({ where: { id, ...tenantWhere(actor) } });
      if (!item) return NextResponse.json({ error: "CATALOG_ITEM_NOT_FOUND" }, { status: 404 });
      await prisma.department.delete({ where: { id } });
    } else {
      const item = await prisma.position.findFirst({ where: { id, ...tenantWhere(actor) } });
      if (!item) return NextResponse.json({ error: "CATALOG_ITEM_NOT_FOUND" }, { status: 404 });
      await prisma.position.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "DELETE_CATALOG_FAILED" }, { status: 400 });
  }
}

async function saveCatalogItem(payload: z.infer<typeof catalogSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  if (payload.kind === "Khoa/phòng") {
    const item = payload.id
      ? await updateDepartment(payload, actor)
      : await prisma.department.create({
          data: {
            ...tenantData(actor),
            name: payload.name,
            code: payload.code || null,
            description: payload.note || null
          }
        });

    return {
      id: item.id,
      kind: "Khoa/phòng",
      name: item.name,
      code: item.code ?? "",
      status: "Hoạt động",
      note: item.description ?? ""
    };
  }

  const item = payload.id
    ? await updatePosition(payload, actor)
    : await prisma.position.create({
        data: {
          ...tenantData(actor),
          name: payload.name,
          requiredHours: payload.requiredHours ? Math.round(payload.requiredHours) : 120
        }
      });

  return {
    id: item.id,
    kind: "Chức danh",
    name: item.name,
    code: "",
    status: "Hoạt động",
    note: payload.note ?? "",
    policyName: item.requiredHours ? `CME ${item.requiredHours} tiết / 5 năm` : "",
    requiredHours: item.requiredHours ?? 120,
    annualMinimumHours: payload.annualMinimumHours ?? 12,
    requiresLicense: payload.requiresLicense ?? true
  };
}

async function updateDepartment(payload: z.infer<typeof catalogSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const item = await prisma.department.findFirst({ where: { id: payload.id, ...tenantWhere(actor) } });
  if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
  return prisma.department.update({
    where: { id: item.id },
    data: {
      name: payload.name,
      code: payload.code || null,
      description: payload.note || null
    }
  });
}

async function updatePosition(payload: z.infer<typeof catalogSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const item = await prisma.position.findFirst({ where: { id: payload.id, ...tenantWhere(actor) } });
  if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
  return prisma.position.update({
    where: { id: item.id },
    data: {
      name: payload.name,
      requiredHours: payload.requiredHours ? Math.round(payload.requiredHours) : 120
    }
  });
}
