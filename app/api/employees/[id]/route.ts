import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { mapEmployee, toAccountStatus } from "@/lib/api-mappers";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  hours: z.number().optional(),
  requiredHours: z.number().optional(),
  avatarUrl: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const { id } = await params;
    const payload = patchSchema.parse(await request.json());
    const before = await prisma.user.findUnique({ where: { id }, include: { department: true, position: true, role: true } });
    if (!before) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });

    const [department, position, role] = await Promise.all([
      payload.department === undefined ? before.department : findOrCreateDepartment(payload.department),
      payload.position === undefined ? before.position : findOrCreatePosition(payload.position, payload.requiredHours),
      payload.role === undefined ? before.role : findOrCreateRole(payload.role)
    ]);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: payload.name,
        username: payload.username,
        email: payload.email,
        phone: payload.phone,
        avatarUrl: payload.avatarUrl,
        licenseNumber: payload.licenseNumber,
        status: payload.status ? toAccountStatus(payload.status) : undefined,
        departmentId: department?.id,
        positionId: position?.id,
        roleId: role?.id
      },
      include: { department: true, position: true, role: true, summaries: { orderBy: { updatedAt: "desc" }, take: 1 } }
    });

    if (payload.hours !== undefined || payload.requiredHours !== undefined) {
      const activeCycle = await prisma.trainingCycle.findFirst({ where: { isActive: true }, orderBy: { startYear: "desc" } });
      if (activeCycle) {
        const currentSummary = updated.summaries[0];
        const approvedHours = payload.hours ?? currentSummary?.approvedHours ?? 0;
        const requiredHours = payload.requiredHours ?? currentSummary?.requiredHours ?? updated.position?.requiredHours ?? 48;
        await prisma.trainingSummary.upsert({
          where: { userId_cycleId: { userId: id, cycleId: activeCycle.id } },
          update: { approvedHours, requiredHours, missingHours: Math.max(requiredHours - approvedHours, 0), compliant: approvedHours >= requiredHours },
          create: { userId: id, cycleId: activeCycle.id, approvedHours, requiredHours, missingHours: Math.max(requiredHours - approvedHours, 0), compliant: approvedHours >= requiredHours }
        });
      }
    }

    const data = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: { department: true, position: true, role: true, summaries: { orderBy: { updatedAt: "desc" }, take: 1 } }
    });
    await writeAuditLog({ actor, action: "employee.update", entityType: "User", entityId: id, before, after: payload, request });
    return NextResponse.json({ data: mapEmployee(data), storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "UPDATE_EMPLOYEE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const { id } = await params;
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ ok: true });
    await prisma.user.update({ where: { id }, data: { status: "INACTIVE" } });
    await writeAuditLog({ actor, action: "employee.lock", entityType: "User", entityId: id, before, after: { status: "INACTIVE" }, request });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "DELETE_EMPLOYEE_FAILED" }, { status: 400 });
  }
}

async function findOrCreateDepartment(name?: string | null) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.department.upsert({ where: { name: value }, update: {}, create: { name: value } });
}

async function findOrCreatePosition(name?: string | null, requiredHours = 48) {
  const value = name?.trim();
  if (!value) return null;
  return prisma.position.upsert({ where: { name: value }, update: { requiredHours }, create: { name: value, requiredHours } });
}

async function findOrCreateRole(name?: string | null) {
  const value = name?.trim() || "Nhan vien";
  return prisma.role.upsert({ where: { name: value }, update: {}, create: { name: value } });
}
