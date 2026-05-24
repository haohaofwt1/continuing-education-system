"use client";

import React, { useState } from "react";
import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCertificates, getEmployees, type DemoCertificate, type DemoEmployee } from "@/lib/demo-store";

const suggestions = [
  "Ai đang thiếu số tiết trong năm 2026?",
  "Liệt kê chứng chỉ sắp hết hạn trong 90 ngày tới.",
  "Những ai chưa có số CCHN?",
  "Tạo báo cáo đào tạo liên tục tháng này."
];

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  meta?: string;
};

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Tôi có thể trả lời theo dữ liệu nhân sự và chứng chỉ hiện tại: thiếu số tiết, thiếu CCHN, chứng chỉ sắp hết hạn, trạng thái duyệt và tóm tắt báo cáo. Nếu đã cấu hình OpenAI trong Cài đặt hệ thống hoặc .env, câu trả lời sẽ dùng OpenAI; nếu chưa có key, hệ thống dùng bộ phân tích local."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [debugAction, setDebugAction] = useState<object | null>(null);
  const [dbData, setDbData] = useState<{ employees: DemoEmployee[]; certificates: DemoCertificate[] } | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, certRes] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/certificates")
        ]);
        const emp: { data: DemoEmployee[]; storage?: string } = await empRes.json();
        const cert: { data: DemoCertificate[]; storage?: string } = await certRes.json();
        if (emp.storage === "database" || cert.storage === "database") {
          setDbData({ employees: emp.data, certificates: cert.data });
        }
      } catch {
        // Fallback handled by using dbData || getEmployees()
      }
    };
    void fetchData();
  }, []);

  const submitQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((items) => [...items, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const context = dbData || {
        employees: getEmployees(),
        certificates: getCertificates()
      };
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          mode: "chat",
          context
        })
      });
      const data = await response.json();
      setDebugAction(data.action ?? null);
      setMessages((items) => [
        ...items,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer ?? "Không có phản hồi từ AI.",
          meta: data.provider === "openai" ? `OpenAI · ${data.model}` : formatLocalFallbackMeta(data.error)
        }
      ]);
    } catch {
      setMessages((items) => [...items, { id: `e-${Date.now()}`, role: "assistant", content: "Không gọi được API AI. Vui lòng thử lại.", meta: "Lỗi kết nối" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Trợ lý AI" title="Hỏi dữ liệu đào tạo bằng ngôn ngữ tự nhiên" description="Chat theo dữ liệu nhân sự/chứng chỉ hiện tại; tự dùng OpenAI khi đã cấu hình trong hệ thống và fallback local khi chưa có key." />
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader><CardTitle>Gợi ý câu hỏi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((item) => (
              <Button key={item} variant="secondary" className="w-full justify-start" onClick={() => void submitQuestion(item)}>
                <Sparkles className="h-4 w-4" />{item}
              </Button>
            ))}
            <div className="rounded-2xl border bg-teal-50/60 p-4 text-xs leading-5 text-slate-600">
              Cấu hình tại <span className="font-semibold text-slate-900">Quản trị / Cài đặt hệ thống</span>, mục <span className="font-semibold text-slate-900">Kết nối OpenAI</span>. Có thể đặt <span className="font-semibold text-slate-900">OPENAI_MODEL</span>, mặc định là <span className="font-semibold text-slate-900">gpt-5-mini</span>.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cuộc hội thoại</CardTitle></CardHeader>
          <CardContent>
            <div className="min-h-80 rounded-2xl border bg-teal-50 p-5">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                    {message.role === "assistant" ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white"><Bot className="h-5 w-5" /></div> : null}
                    <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-teal-600 text-white" : "bg-white text-slate-700"}`}>
                      {message.content}
                      {message.meta ? <div className={`mt-3 text-xs font-semibold ${message.role === "user" ? "text-teal-50" : "text-teal-700"}`}>{message.meta}</div> : null}
                    </div>
                    {message.role === "user" ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-teal-700"><UserRound className="h-5 w-5" /></div> : null}
                  </div>
                ))}
                {loading ? (
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white"><Bot className="h-5 w-5" /></div>
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">Đang phân tích dữ liệu...</div>
                  </div>
                ) : null}
              </div>
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(question);
              }}
            >
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Nhập câu hỏi..." />
              <Button type="submit" disabled={loading}><Send className="h-4 w-4" />{loading ? "Đang xử lý" : "Gửi"}</Button>
            </form>
            {debugAction ? (
              <details className="mt-3 rounded-2xl border p-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">Action/filter object</summary>
                <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(debugAction, null, 2)}</pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function formatLocalFallbackMeta(error?: string) {
  if (error === "OPENAI_QUOTA_EXCEEDED") return "Local fallback · OpenAI API hết quota";
  if (error === "OPENAI_AUTH_FAILED") return "Local fallback · OpenAI API key chưa hợp lệ";
  if (error === "OPENAI_UNAVAILABLE") return "Local fallback · OpenAI tạm thời không khả dụng";
  return "Local fallback";
}
