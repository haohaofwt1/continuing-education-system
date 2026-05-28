import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/lib/storage";

const createMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().max(4000).optional()
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
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        attachments: { orderBy: { createdAt: "asc" } }
      }
    }), 2000);
    const session = await auth();
    if (session?.user?.id) {
      await withTimeout(prisma.conversationMember.updateMany({
        where: { conversationId, userId: session.user.id },
        data: { lastReadAt: new Date() }
      }), 2000).catch(() => null);
      const unreadMessageIds = messages.filter((message) => message.authorId !== session.user.id).map((message) => message.id);
      await withTimeout(prisma.messageReadReceipt.createMany({
        data: unreadMessageIds.map((messageId) => ({ messageId, userId: session.user.id as string })),
        skipDuplicates: true
      }), 2000).catch(() => null);
    }
    return NextResponse.json({
      data: messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        author: message.author?.name ?? "System",
        body: message.body,
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          url: attachment.url
        })),
        createdAt: message.createdAt,
        mine: message.authorId === session?.user?.id
      }))
    });
  } catch (error) {
    console.error("[discuss.messages.GET]", error);
    return NextResponse.json({ data: [], error: "DISCUSS_DATABASE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseMessageRequest(request);
    if (!payload.body.trim() && !payload.files.length) {
      return NextResponse.json({ error: "MESSAGE_BODY_OR_ATTACHMENT_REQUIRED" }, { status: 400 });
    }
    const session = await auth();
    const currentUser = session?.user?.id
      ? await withTimeout(prisma.user.findUnique({ where: { id: session.user.id } }), 2000)
      : await withTimeout(prisma.user.findFirst({ orderBy: { createdAt: "asc" } }), 2000);
    const uploaded = await Promise.all(payload.files.map((file) => putObject(file, "discuss")));
    const message = await withTimeout(prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        authorId: currentUser?.id,
        body: payload.body.trim(),
        attachments: {
          create: uploaded.map((file) => ({
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            url: file.url
          }))
        }
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        attachments: { orderBy: { createdAt: "asc" } }
      }
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
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          url: attachment.url
        })),
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

async function parseMessageRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const conversationId = String(formData.get("conversationId") ?? "");
    const body = String(formData.get("body") ?? "");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    return { ...createMessageSchema.parse({ conversationId, body }), body, files };
  }

  const parsed = createMessageSchema.parse(await request.json());
  return { ...parsed, body: parsed.body ?? "", files: [] as File[] };
}
