import { ConversationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantData, tenantWhere } from "@/lib/tenant";

const createThreadSchema = z.object({
  type: z.nativeEnum(ConversationType).default(ConversationType.CHANNEL),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  memberIds: z.array(z.string()).optional()
});

export async function GET() {
  try {
    const session = await auth();
    await withTimeout(ensureDefaultThreads(), 2000);
    const threads = await withTimeout(prisma.conversation.findMany({
      where: {
        ...tenantWhere({ tenantId: session?.user?.tenantId, permissions: [], demoMode: !session?.user }),
        OR: [
          { type: ConversationType.CHANNEL },
          ...(session?.user?.id ? [{ members: { some: { userId: session.user.id } } }] : [])
        ]
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { id: true, name: true } } } },
        _count: { select: { messages: true } }
      }
    }), 2000);

    return NextResponse.json({
      data: threads.map((thread) => ({
        id: thread.id,
        type: thread.type,
        name: thread.name ?? directName(thread.members.map((member) => member.user.name)),
        description: thread.description ?? `${thread.members.length} thành viên`,
        memberCount: thread.members.length,
        messageCount: thread._count.messages,
        lastMessage: thread.messages[0]
          ? {
              body: thread.messages[0].body,
              author: thread.messages[0].author?.name ?? "System",
              createdAt: thread.messages[0].createdAt
            }
          : null,
        members: thread.members.map((member) => member.user)
      }))
    });
  } catch (error) {
    console.error("[discuss.threads.GET]", error);
    return NextResponse.json({ data: [], error: "DISCUSS_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = createThreadSchema.parse(await request.json());
    const currentUser = await withTimeout(getCurrentUser(), 2000);
    const memberIds = Array.from(new Set([currentUser?.id, ...(payload.memberIds ?? [])].filter(Boolean))) as string[];
    if (payload.type === ConversationType.DIRECT && memberIds.length !== 2) {
      return NextResponse.json({ error: "DIRECT_REQUIRES_EXACTLY_TWO_MEMBERS" }, { status: 400 });
    }
    if (payload.type === ConversationType.DIRECT && currentUser) {
      const directThreads = await withTimeout(prisma.conversation.findMany({
        where: {
          ...tenantWhere({ tenantId: currentUser.tenantId, permissions: [], demoMode: false }),
          type: ConversationType.DIRECT,
          members: { some: { userId: currentUser.id } }
        },
        include: { members: true }
      }), 2000);
      const existing = directThreads.find((thread) => {
        const ids = thread.members.map((member) => member.userId).sort();
        return ids.length === 2 && ids.join(":") === [...memberIds].sort().join(":");
      });
      if (existing) return NextResponse.json({ data: existing }, { status: 200 });
    }
    const thread = await withTimeout(prisma.conversation.create({
      data: {
        ...tenantData({ tenantId: currentUser?.tenantId, permissions: [], demoMode: !currentUser }),
        type: payload.type,
        name: payload.type === ConversationType.DIRECT ? null : payload.name,
        description: payload.description,
        isPrivate: payload.type === ConversationType.DIRECT,
        createdById: currentUser?.id,
        members: { create: memberIds.map((userId) => ({ userId })) }
      }
    }), 2000);
    return NextResponse.json({ data: thread }, { status: 201 });
  } catch (error) {
    console.error("[discuss.threads.POST]", error);
    return NextResponse.json({ error: "CREATE_THREAD_FAILED" }, { status: 400 });
  }
}

async function ensureDefaultThreads() {
  const count = await prisma.conversation.count();
  if (count > 0) return;
  const users = await prisma.user.findMany({ take: 20, orderBy: { createdAt: "asc" } });
  if (!users.length) return;
  const admin = users[0];
  for (const channel of [
    { name: "All", description: "Kênh chung toàn đơn vị" },
    { name: "Administrators", description: "Trao đổi quản trị hệ thống" },
    { name: "Đào tạo liên tục", description: "Nhắc hồ sơ, chứng chỉ, số tiết" }
  ]) {
    const thread = await prisma.conversation.create({
      data: {
        type: ConversationType.CHANNEL,
        name: channel.name,
        description: channel.description,
        createdById: admin.id,
        members: { create: users.map((user) => ({ userId: user.id })) }
      }
    });
    await prisma.message.create({
      data: {
        conversationId: thread.id,
        authorId: admin.id,
        body: channel.name === "All" ? "Chào mừng mọi người đến kênh trao đổi nội bộ." : `Đã tạo kênh ${channel.name}.`
      }
    });
  }
}

async function getCurrentUser() {
  const session = await auth();
  if (session?.user?.id) return prisma.user.findUnique({ where: { id: session.user.id } });
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}

function directName(names: string[]) {
  return names.slice(0, 3).join(", ") || "Tin nhắn";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => windowlessTimeout(reject, timeoutMs))
  ]);
}

function windowlessTimeout(reject: (reason?: unknown) => void, timeoutMs: number) {
  return setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), timeoutMs);
}
