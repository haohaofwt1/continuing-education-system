import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(4000)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ data: [] });

  try {
    const messages = await withTimeout(prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { author: { select: { id: true, name: true, avatarUrl: true } } }
    }), 2000);
    return NextResponse.json({
      data: messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        author: message.author?.name ?? "System",
        body: message.body,
        createdAt: message.createdAt
      }))
    });
  } catch (error) {
    console.error("[discuss.messages.GET]", error);
    return NextResponse.json({ data: [], error: "DISCUSS_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = createMessageSchema.parse(await request.json());
    const currentUser = await withTimeout(prisma.user.findFirst({ orderBy: { createdAt: "asc" } }), 2000);
    const message = await withTimeout(prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        authorId: currentUser?.id,
        body: payload.body
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } }
    }), 2000);
    await withTimeout(prisma.conversation.update({
      where: { id: payload.conversationId },
      data: { updatedAt: new Date() }
    }), 2000);
    return NextResponse.json({
      data: {
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        author: message.author?.name ?? "System",
        body: message.body,
        createdAt: message.createdAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error("[discuss.messages.POST]", error);
    return NextResponse.json({ error: "CREATE_MESSAGE_FAILED" }, { status: 400 });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), timeoutMs))
  ]);
}
