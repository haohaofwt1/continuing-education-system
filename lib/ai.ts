import { z } from "zod";
import type { DemoCertificate, DemoEmployee } from "@/lib/demo-store";
import { getServerAiSettings } from "@/lib/server-ai-settings";

export const naturalLanguageFilterSchema = z.object({
  query: z.string(),
  entity: z.enum(["employee", "certificate", "report"]).default("certificate"),
  filters: z.record(z.unknown()).default({}),
  action: z.enum(["create_filter", "create_report", "summarize_profile", "draft_reminder"]).default("create_filter")
});

export type AssistantContext = {
  employees?: DemoEmployee[];
  certificates?: DemoCertificate[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type OpenAIAnswerResult = {
  answer: string;
  model: string | null;
  error?: string;
};

export async function naturalLanguageFilter(query: string) {
  const lower = query.toLowerCase();
  return naturalLanguageFilterSchema.parse({
    query,
    entity: lower.includes("ai") || lower.includes("nhân sự") ? "employee" : "certificate",
    action: lower.includes("báo cáo") ? "create_report" : "create_filter",
    filters: {
      year: lower.includes("2026") ? 2026 : undefined,
      expiringWithinDays: lower.includes("60") ? 60 : lower.includes("90") ? 90 : undefined,
      missingLicense: lower.includes("cchn") ? true : undefined,
      belowHours: lower.includes("dưới 24") ? 24 : undefined
    }
  });
}

export async function answerAssistantQuestion(question: string, context: AssistantContext = {}) {
  const action = await naturalLanguageFilter(question);
  const fallbackAnswer = answerFromLocalData(question, context);
  const openAiAnswer: OpenAIAnswerResult = await answerWithOpenAI(question, context).catch((error: Error) => ({
    answer: "",
    model: null,
    error: error.message
  }));

  return {
    answer: openAiAnswer.answer || fallbackAnswer,
    action,
    provider: openAiAnswer.answer ? "openai" : "local",
    model: openAiAnswer.answer ? openAiAnswer.model : null,
    error: openAiAnswer.error ? normalizeOpenAiError(openAiAnswer.error) : undefined
  };
}

async function answerWithOpenAI(question: string, context: AssistantContext) {
  const settings = await getServerAiSettings();
  const apiKey = process.env.OPENAI_API_KEY || settings.openaiApiKey;
  const model = process.env.OPENAI_MODEL || settings.openaiModel || "gpt-5-mini";
  if (!apiKey) {
    return { answer: "", model: null, error: "OPENAI_API_KEY chưa được cấu hình." };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions: [
        "Bạn là trợ lý AI cho hệ thống đào tạo liên tục y tế.",
        "Trả lời bằng tiếng Việt, ngắn gọn, dựa trên dữ liệu JSON được cung cấp.",
        "Nếu dữ liệu không đủ để kết luận, nói rõ thiếu dữ liệu nào.",
        "Không bịa số liệu ngoài context."
      ].join("\n"),
      input: `Câu hỏi: ${question}\n\nDữ liệu hệ thống:\n${JSON.stringify(compactContext(context), null, 2)}`
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API lỗi ${response.status}: ${detail.slice(0, 240)}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const answer = data.output_text || data.output?.flatMap((item) => item.content ?? []).map((item) => item.text).filter(Boolean).join("\n") || "";
  return { answer: answer.trim(), model, error: undefined };
}

function normalizeOpenAiError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("quota") || lower.includes("insufficient_quota") || lower.includes("429")) {
    return "OPENAI_QUOTA_EXCEEDED";
  }
  if (lower.includes("401") || lower.includes("invalid authentication") || lower.includes("incorrect api key")) {
    return "OPENAI_AUTH_FAILED";
  }
  return "OPENAI_UNAVAILABLE";
}

function answerFromLocalData(question: string, context: AssistantContext) {
  const employees = context.employees ?? [];
  const certificates = context.certificates ?? [];
  const lower = question.toLowerCase();

  if (!question.trim()) return "Bạn nhập câu hỏi để tôi kiểm tra dữ liệu nhân sự, chứng chỉ, số tiết hoặc CCHN.";

  if (lower.includes("thiếu") && lower.includes("số tiết")) {
    const rows = employees.filter((employee) => employee.hours < employee.requiredHours);
    if (!rows.length) return "Không có nhân sự thiếu số tiết theo dữ liệu hiện tại.";
    return `Có ${rows.length} nhân sự thiếu số tiết:\n${rows.map((employee) => `- ${employee.name}: ${employee.hours}/${employee.requiredHours} tiết, còn thiếu ${employee.requiredHours - employee.hours}`).join("\n")}`;
  }

  if (lower.includes("cchn")) {
    const rows = employees.filter((employee) => !employee.licenseNumber || employee.status === "Thiếu CCHN");
    if (!rows.length) return "Không có hồ sơ thiếu số CCHN theo dữ liệu hiện tại.";
    return `Có ${rows.length} hồ sơ thiếu CCHN:\n${rows.map((employee) => `- ${employee.name} (${employee.department})`).join("\n")}`;
  }

  if (lower.includes("sắp hết hạn") || lower.includes("hết hạn")) {
    const days = lower.includes("90") ? 90 : lower.includes("60") ? 60 : 90;
    const today = new Date();
    const rows = certificates.filter((certificate) => {
      if (!certificate.expiredDate) return false;
      const expiredDate = new Date(`${certificate.expiredDate}T00:00:00`);
      const diffDays = (expiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= days;
    });
    if (!rows.length) return `Không có chứng chỉ sắp hết hạn trong ${days} ngày tới theo dữ liệu hiện tại.`;
    return `Có ${rows.length} chứng chỉ sắp hết hạn trong ${days} ngày tới:\n${rows.map((certificate) => `- ${certificate.title} - ${certificate.holder}, hết hạn ${certificate.expiredDate}`).join("\n")}`;
  }

  if (lower.includes("báo cáo")) {
    const approved = certificates.filter((certificate) => certificate.status === "Đã duyệt").length;
    const pending = certificates.filter((certificate) => certificate.status === "Chờ duyệt").length;
    const missingInfo = certificates.filter((certificate) => certificate.status === "Thiếu thông tin").length;
    return `Tóm tắt nhanh: ${employees.length} nhân sự, ${certificates.length} chứng chỉ, ${approved} đã duyệt, ${pending} chờ duyệt, ${missingInfo} thiếu thông tin.`;
  }

  return `Tôi đã nhận câu hỏi. Dữ liệu hiện có gồm ${employees.length} nhân sự và ${certificates.length} chứng chỉ. Bạn có thể hỏi về người thiếu số tiết, thiếu CCHN, chứng chỉ sắp hết hạn hoặc yêu cầu tóm tắt báo cáo.`;
}

function compactContext(context: AssistantContext) {
  return {
    employees: (context.employees ?? []).map((employee) => ({
      name: employee.name,
      department: employee.department,
      position: employee.position,
      licenseNumber: employee.licenseNumber,
      status: employee.status,
      hours: employee.hours,
      requiredHours: employee.requiredHours
    })),
    certificates: (context.certificates ?? []).map((certificate) => ({
      code: certificate.code,
      title: certificate.title,
      holder: certificate.holder,
      department: certificate.department,
      type: certificate.type,
      issuer: certificate.issuer,
      issuedDate: certificate.issuedDate,
      expiredDate: certificate.expiredDate,
      hours: certificate.hours,
      status: certificate.status,
      confidence: certificate.confidence
    }))
  };
}
