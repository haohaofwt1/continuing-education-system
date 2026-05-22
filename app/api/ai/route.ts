import { NextResponse } from "next/server";
import { answerAssistantQuestion, AssistantContext, naturalLanguageFilter } from "@/lib/ai";
import { writeAuditLog } from "@/lib/audit";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/server-permissions";

export async function POST(request: Request) {
  try {
    rateLimit(request, "ai", 30);
    const actor = await requirePermission(permissions.aiChat);
    const body = (await request.json()) as { query?: string; mode?: "filter" | "chat"; context?: AssistantContext; confirmAction?: boolean };
    const query = body.query ?? "";
    const result = body.mode === "filter" ? await naturalLanguageFilter(query) : await answerAssistantQuestion(query, body.context);
    const status = body.confirmAction ? "ACCEPTED" : "SUGGESTED";

    await prisma.aiActionLog.create({
      data: {
        tenantId: actor.tenantId ?? undefined,
        actorId: actor.id,
        action: body.mode === "filter" ? "ai.report_filter_draft" : "ai.chat",
        status,
        prompt: query,
        toolName: body.mode === "filter" ? "naturalLanguageFilter" : "answerAssistantQuestion",
        input: { mode: body.mode ?? "chat" },
        output: JSON.parse(JSON.stringify(result))
      }
    });
    await writeAuditLog({ actor, action: "ai.suggest", entityType: "AiActionLog", after: { query, mode: body.mode ?? "chat", status }, request });

    return NextResponse.json({ ...result, actionStatus: status });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "AI_REQUEST_FAILED" }, { status: 400 });
  }
}
