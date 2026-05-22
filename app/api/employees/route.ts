import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { mapEmployee, toAccountStatus } from "@/lib/api-mappers";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/server-permissions";

const employeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  username: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  hours: z.number().optional().default(0),
  requiredHours: z.number().optional().default(48),
  avatarUrl: z.string().optional().nullable()
});

export async function GET(request: Request) {
  try {
    await requirePermission(permissions.viewPersonnel);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { licenseNumber: { contains: q, mode: "insensitive" } }
            ]
          }
        : undefined,
      include: {
        department: true,
        position: true,
        role: true,
        summaries: { orderBy: { updatedAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" }
    });
    const data = users.map(mapEmployee);
    return NextResponse.json({ data, page: 1, pageSize: data.length, total: data.length, storage: "database" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ data: [], error: "EMPLOYEES_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(permissions.managePersonnel);
    const payload = employeeSchema.parse(await request.json());
    const user = await upsertEmployee(payload);
    await writeAuditLog({ actor, action: "employee.create", entityType: "User", entityId: user.id, after: payload, request });
    return NextResponse.json({ data: mapEmployee(user), storage: "database" }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "CREATE_EMPLOYEE_FAILED" }, { status: 400 });
  }
}

async function upsertEmployee(payload: z.infer<typeof employeeSchema>) {
  const [department, position, role] = await Promise.all([
    findOrCreateDepartment(payload.department),
    findOrCreatePosition(payload.position, payload.requiredHours),
    findOrCreateRole(payload.role)
  ]);
  const activeCycle = await prisma.trainingCycle.findFirst({ where: { isActive: true }, orderBy: { startYear: "desc" } });
  const username = payload.username || payload.email.split("@")[0];
  const data = {
    name: payload.name,
    username,
    email: payload.email,
    phone: payload.phone || null,
    avatarUrl: payload.avatarUrl || null,
    licenseNumber: payload.licenseNumber || null,
    status: toAccountStatus(payload.status),
    departmentId: department?.id,
    positionId: position?.id,
    roleId: role?.id
  };

  const user = payload.id
    ? await prisma.user.upsert({
        where: { id: payload.id },
        update: data,
        create: { id: payload.id, ...data },
        include: { department: true, position: true, role: true, summaries: { orderBy: { updatedAt: "desc" }, take: 1 } }
      })
    : await prisma.user.upsert({
        where: { email: payload.email },
        update: data,
        create: data,
        include: { department: true, position: true, role: true, summaries: { orderBy: { updatedAt: "desc" }, take: 1 } }
      });

  if (activeCycle) {
    await prisma.trainingSummary.upsert({
      where: { userId_cycleId: { userId: user.id, cycleId: activeCycle.id } },
      update: {
        approvedHours: payload.hours,
        requiredHours: payload.requiredHours,
        missingHours: Math.max(payload.requiredHours - payload.hours, 0),
        compliant: payload.hours >= payload.requiredHours
      },
      create: {
        userId: user.id,
        cycleId: activeCycle.id,
        approvedHours: payload.hours,
        requiredHours: payload.requiredHours,
        missingHours: Math.max(payload.requiredHours - payload.hours, 0),
        compliant: payload.hours >= payload.requiredHours
      }
    });
  }

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { department: true, position: true, role: true, summaries: { orderBy: { updatedAt: "desc" }, take: 1 } }
  });
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
