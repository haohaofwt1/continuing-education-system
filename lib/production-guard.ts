import { isDemoFallbackEnabled } from "@/lib/demo-mode";

export function assertProductionDataSource() {
  if (process.env.NODE_ENV !== "production") return;
  if (isDemoFallbackEnabled()) {
    throw new Response(JSON.stringify({ error: "PRODUCTION_DEMO_FALLBACK_ENABLED" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export function assertProductionSecret(name: string, value?: string) {
  if (process.env.NODE_ENV !== "production") return;
  if (!value || value.includes("replace-with") || value.length < 32) {
    throw new Error(`${name} must be a secure production secret`);
  }
}
