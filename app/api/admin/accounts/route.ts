import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { mapEmployee, toAccountStatus } from "@/lib/api-mappers";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";
import { tenantData, tenantWhere } from "@/lib/tenant";

const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  username: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  status: z.string().optional().nullable()
});

export async function GET() {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const users = await prisma.user.findMany({
      where: tenantWhere(actor),
      include: {
        department: true,
        position: true,
        role: true,
        summaries: { orderBy: { updatedAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ data: users.map(mapEmployee), storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ data: [], error: "ACCOUNTS_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const payload = accountSchema.parse(await request.json());
    const user = await upsertAccount(payload, actor);
    return NextResponse.json({ data: mapEmployee(user), storage: "database" }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "SAVE_ACCOUNT_FAILED" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const payload = z.object({
      id: z.string().min(1),
      action: z.enum(["reset-password", "status"]),
      status: z.string().optional()
    }).parse(await request.json());

    const user = await prisma.user.findFirst({ where: { id: payload.id, ...tenantWhere(actor) } });
    if (!user) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });

    if (payload.action === "reset-password") {
      const password = generatePassword();
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      return NextResponse.json({ ok: true, password });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status: toAccountStatus(payload.status) },
      include: {
        department: true,
        position: true,
        role: true,
        summaries: { orderBy: { updatedAt: "desc" }, take: 1 }
      }
    });
    return NextResponse.json({ data: mapEmployee(updated), storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "UPDATE_ACCOUNT_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ACCOUNT_ID_REQUIRED" }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { id, ...tenantWhere(actor) } });
    if (!user) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    await prisma.user.update({ where: { id: user.id }, data: { status: "LOCKED" } });
    return NextResponse.json({ ok: true, mode: "locked" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "DELETE_ACCOUNT_FAILED" }, { status: 400 });
  }
}

async function upsertAccount(payload: z.infer<typeof accountSchema>, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const [department, position, role] = await Promise.all([
    findDepartment(payload.department, actor),
    findPosition(payload.position, actor),
    findRole(payload.role, actor)
  ]);
  const username = payload.username || payload.email.split("@")[0];
  const defaultPasswordHash = await bcrypt.hash(process.env.DEFAULT_USER_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!", 12);
  const data = {
    ...tenantData(actor),
    name: payload.name,
    username,
    email: payload.email,
    phone: payload.phone || null,
    departmentId: department?.id,
    positionId: position?.id,
    roleId: role?.id,
    status: toAccountStatus(payload.status)
  };

  const user = payload.id
    ? await prisma.user.update({ where: { id: payload.id }, data })
    : await prisma.user.upsert({
        where: { email: payload.email },
        update: data,
        create: { ...data, passwordHash: defaultPasswordHash }
      });

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      department: true,
      position: true,
      role: true,
      summaries: { orderBy: { updatedAt: "desc" }, take: 1 }
    }
  });
}

async function findDepartment(name: string | null | undefined, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.department.upsert({
    where: { name: value },
    update: {},
    create: { ...tenantData(actor), name: value }
  });
}

async function findPosition(name: string | null | undefined, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.position.upsert({
    where: { name: value },
    update: {},
    create: { ...tenantData(actor), name: value, requiredHours: 120 }
  });
}

async function findRole(name: string | null | undefined, actor: Awaited<ReturnType<typeof requirePermission>>) {
  const value = normalizeRole(name?.trim() || "Nhan vien");
  const permissionKeys = value === "Nhan vien" ? ["certificates.view", "certificates.create"] : [];
  const permissionRows = permissionKeys.length ? await prisma.permission.findMany({ where: { key: { in: permissionKeys } } }) : [];
  return prisma.role.upsert({
    where: { name: value },
    update: permissionRows.length ? { permissions: { connect: permissionRows.map((permission) => ({ id: permission.id })) } } : {},
    create: {
      ...tenantData(actor),
      name: value,
      permissions: permissionRows.length ? { connect: permissionRows.map((permission) => ({ id: permission.id })) } : undefined
    }
  });
}

function normalizeRole(role: string) {
  if (role === "Nhân viên") return "Nhan vien";
  if (role === "Người rà soát báo cáo") return "Nguoi ra soat bao cao";
  return role;
}

function generatePassword() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `Cme@${new Date().getFullYear()}${suffix}`;
}
