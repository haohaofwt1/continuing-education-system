import { prisma } from "@/lib/prisma";
import { getServerAiSettings } from "@/lib/server-ai-settings";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export async function getProductionReadiness() {
  const checks: ReadinessCheck[] = [];

  checks.push(await checkDatabase());
  checks.push(checkAuthSecret());
  checks.push(checkStorage());
  checks.push(await checkTenantFoundation());
  checks.push(await checkCommercialTables());
  checks.push(await checkAI());
  checks.push(checkRealtime());
  checks.push(checkDemoFallback());

  const failed = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;

  return {
    ready: failed === 0,
    failed,
    warnings,
    checks
  };
}

async function checkDatabase(): Promise<ReadinessCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { key: "database", label: "PostgreSQL", status: "pass", detail: "Database reachable." };
  } catch {
    return { key: "database", label: "PostgreSQL", status: "fail", detail: "DATABASE_URL is not reachable or migrations are not ready." };
  }
}

function checkAuthSecret(): ReadinessCheck {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "replace-with-a-secure-random-secret" || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    return { key: "auth", label: "Auth secret", status: "fail", detail: "AUTH_SECRET must be set to a secure production value." };
  }
  return { key: "auth", label: "Auth secret", status: "pass", detail: "AUTH_SECRET is configured." };
}

function checkStorage(): ReadinessCheck {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "local") {
    return {
      key: "storage",
      label: "File storage",
      status: process.env.NODE_ENV === "production" ? "fail" : "warn",
      detail: "STORAGE_PROVIDER is local. Use Vercel Blob, R2, S3 or Supabase Storage for production."
    };
  }
  if (provider === "vercel_blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    return { key: "storage", label: "File storage", status: "fail", detail: "BLOB_READ_WRITE_TOKEN is required for Vercel Blob." };
  }
  if (provider === "r2" && (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET)) {
    return { key: "storage", label: "File storage", status: "fail", detail: "R2 storage variables are incomplete." };
  }
  if (provider === "supabase" && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return { key: "storage", label: "File storage", status: "fail", detail: "Supabase storage variables are incomplete." };
  }
  if (provider !== "supabase") {
    return { key: "storage", label: "File storage", status: "warn", detail: `${provider} is configured, but only the Supabase upload adapter is implemented in this build.` };
  }
  return { key: "storage", label: "File storage", status: "pass", detail: `${provider} is configured.` };
}

async function checkTenantFoundation(): Promise<ReadinessCheck> {
  try {
    const tenants = await prisma.tenant.count();
    if (tenants === 0) {
      return { key: "tenant", label: "Tenant foundation", status: "fail", detail: "No tenant exists. Run seed or create a tenant before commercial use." };
    }
    return { key: "tenant", label: "Tenant foundation", status: "pass", detail: `${tenants} tenant record(s) configured.` };
  } catch {
    return { key: "tenant", label: "Tenant foundation", status: "fail", detail: "Tenant tables are not migrated." };
  }
}

async function checkCommercialTables(): Promise<ReadinessCheck> {
  try {
    await Promise.all([
      prisma.ocrJob.count(),
      prisma.reportArtifact.count(),
      prisma.certificateReviewEvent.count(),
      prisma.aiActionLog.count(),
      prisma.tenantUsageRecord.count()
    ]);
    return { key: "commercial_tables", label: "Commercial tables", status: "pass", detail: "OCR jobs, report artifacts, review events, AI logs and usage quotas are migrated." };
  } catch {
    return { key: "commercial_tables", label: "Commercial tables", status: "fail", detail: "Run Prisma migration for commercial tables." };
  }
}

async function checkAI(): Promise<ReadinessCheck> {
  const settings = await getServerAiSettings();
  if (!process.env.OPENAI_API_KEY && !settings.openaiApiKey) {
    return { key: "ai", label: "AI assistant", status: "warn", detail: "OpenAI key is not configured. AI will use local fallback only." };
  }
  return { key: "ai", label: "AI assistant", status: "pass", detail: `OpenAI model ${process.env.OPENAI_MODEL || settings.openaiModel || "gpt-5-mini"} configured.` };
}

function checkRealtime(): ReadinessCheck {
  const provider = process.env.REALTIME_PROVIDER || "none";
  if (provider === "none" || provider === "polling") {
    return { key: "realtime", label: "Realtime", status: "warn", detail: "Realtime provider is not production-grade yet. Configure Supabase Realtime, WebSocket or queue-backed notifications." };
  }
  return { key: "realtime", label: "Realtime", status: "pass", detail: `${provider} is configured.` };
}

function checkDemoFallback(): ReadinessCheck {
  if (process.env.NEXT_PUBLIC_DEMO_FALLBACK === "false") {
    return { key: "demo", label: "Demo fallback", status: "pass", detail: "Demo fallback is disabled for production." };
  }
  return { key: "demo", label: "Demo fallback", status: "warn", detail: "Demo fallback is enabled. Disable it before commercial launch." };
}
