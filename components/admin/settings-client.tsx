"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSettings, saveSettings } from "@/lib/demo-store";

type AiSettingsStatus = {
  configured: boolean;
  source: "env" | "system" | "none";
  maskedKey: string;
  model: string;
};

export function SettingsClient() {
  const [settings, setSettings] = useState(() => getSettings());
  const [aiStatus, setAiStatus] = useState<AiSettingsStatus | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-5-mini");
  const [savingAi, setSavingAi] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai-settings")
      .then((response) => response.json())
      .then((data: AiSettingsStatus) => {
        setAiStatus(data);
        setOpenaiModel(data.model || "gpt-5-mini");
      })
      .catch(() => setAiStatus(null));
  }, []);

  const saveAiSettings = async () => {
    setSavingAi(true);
    try {
      const response = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey, openaiModel })
      });
      const data = (await response.json()) as AiSettingsStatus;
      setAiStatus(data);
      setOpenaiApiKey("");
      setNotice("Đã lưu cấu hình OpenAI cho trợ lý AI.");
    } catch {
      setNotice("Không lưu được cấu hình OpenAI. Vui lòng thử lại.");
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Quản trị" title="Cài đặt hệ thống" description="Chu kỳ, số tiết yêu cầu, logo, màu thương hiệu, OCR, storage provider và kết nối AI." />
      {notice ? <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-2">
          <Input value={settings.appName} onChange={(event) => setSettings({ ...settings, appName: event.target.value })} />
          <Input value={settings.requiredHours} onChange={(event) => setSettings({ ...settings, requiredHours: Number(event.target.value) })} type="number" />
          <Input value={settings.cycleStartYear} onChange={(event) => setSettings({ ...settings, cycleStartYear: Number(event.target.value) })} type="number" />
          <Input value={settings.cycleEndYear} onChange={(event) => setSettings({ ...settings, cycleEndYear: Number(event.target.value) })} type="number" />
          <Input value={settings.ocrProvider} onChange={(event) => setSettings({ ...settings, ocrProvider: event.target.value })} />
          <Input value={settings.storageProvider} onChange={(event) => setSettings({ ...settings, storageProvider: event.target.value })} />
          <Button className="md:col-span-2" onClick={() => { saveSettings(settings); setNotice("Đã lưu cài đặt demo."); }}>Lưu cài đặt</Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="grid gap-4 p-5">
          <div>
            <div className="text-sm font-semibold text-slate-950">Kết nối OpenAI cho Trợ lý AI</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              API key được lưu ở server và chỉ hiển thị dạng mask. Nếu `.env` có `OPENAI_API_KEY`, hệ thống sẽ ưu tiên key trong `.env`.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">OPENAI_API_KEY</span>
              <Input
                type="password"
                value={openaiApiKey}
                onChange={(event) => setOpenaiApiKey(event.target.value)}
                placeholder={aiStatus?.maskedKey || "sk-..."}
                autoComplete="off"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">OPENAI_MODEL</span>
              <Input value={openaiModel} onChange={(event) => setOpenaiModel(event.target.value)} placeholder="gpt-5-mini" />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-teal-50/60 p-4 text-sm">
            <div className="text-slate-700">
              Trạng thái: <span className="font-semibold text-slate-950">{aiStatus?.configured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
              {aiStatus?.source ? <span className="ml-2 text-slate-500">Nguồn: {aiStatus.source}</span> : null}
              {aiStatus?.maskedKey ? <span className="ml-2 text-slate-500">Key: {aiStatus.maskedKey}</span> : null}
            </div>
            <Button onClick={saveAiSettings} disabled={savingAi || (!openaiApiKey.trim() && !openaiModel.trim())}>
              {savingAi ? "Đang lưu" : "Lưu cấu hình AI"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
