import { NextResponse } from "next/server";
import { getServerAiSettings, maskSecret, saveServerAiSettings } from "@/lib/server-ai-settings";

export async function GET() {
  const settings = await getServerAiSettings();
  const envConfigured = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    configured: envConfigured || Boolean(settings.openaiApiKey),
    source: envConfigured ? "env" : settings.openaiApiKey ? "system" : "none",
    maskedKey: envConfigured ? maskSecret(process.env.OPENAI_API_KEY) : maskSecret(settings.openaiApiKey),
    model: process.env.OPENAI_MODEL || settings.openaiModel || "gpt-5-mini"
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { openaiApiKey?: string; openaiModel?: string };
  const existing = await getServerAiSettings();
  const next = {
    openaiApiKey: body.openaiApiKey?.trim() || existing.openaiApiKey,
    openaiModel: body.openaiModel?.trim() || existing.openaiModel || "gpt-5-mini"
  };

  await saveServerAiSettings(next);

  return NextResponse.json({
    configured: Boolean(process.env.OPENAI_API_KEY || next.openaiApiKey),
    source: process.env.OPENAI_API_KEY ? "env" : "system",
    maskedKey: process.env.OPENAI_API_KEY ? maskSecret(process.env.OPENAI_API_KEY) : maskSecret(next.openaiApiKey),
    model: process.env.OPENAI_MODEL || next.openaiModel || "gpt-5-mini"
  });
}
