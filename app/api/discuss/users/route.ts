import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantWhere } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await auth();
    const users = await prisma.user.findMany({
      where: {
        ...tenantWhere({ tenantId: session?.user?.tenantId, permissions: [], demoMode: !session?.user }),
        ...(session?.user?.id ? { NOT: { id: session.user.id } } : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: { select: { name: true } },
        position: { select: { name: true } }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        department: user.department?.name ?? "",
        position: user.position?.name ?? ""
      }))
    });
  } catch (error) {
    console.error("[discuss.users.GET]", error);
    return NextResponse.json({ data: [], error: "DISCUSS_USERS_UNAVAILABLE" }, { status: 503 });
  }
}
