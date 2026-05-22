import type { RequestActor } from "@/lib/server-permissions";

export function tenantWhere(actor?: RequestActor) {
  if (!actor?.tenantId) return {};
  return { tenantId: actor.tenantId };
}

export function tenantData(actor?: RequestActor) {
  if (!actor?.tenantId) return {};
  return { tenantId: actor.tenantId };
}

export function currentUsagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
