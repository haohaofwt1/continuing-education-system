import { prisma } from "@/lib/prisma";
import type { RequestActor } from "@/lib/server-permissions";

export function audit(action: string, entityType: string, entityId?: string, after?: unknown) {
  return {
    action,
    entityType,
    entityId,
    after,
    createdAt: new Date().toISOString()
  };
}

export async function writeAuditLog({
  actor,
  action,
  entityType,
  entityId,
  before,
  after,
  request
}: {
  actor?: RequestActor;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  request?: Request;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: actor?.tenantId ?? undefined,
        actorId: actor?.id,
        action,
        entityType,
        entityId,
        before: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
        after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
        ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request?.headers.get("user-agent") ?? undefined
      }
    });
  } catch {
    // Audit logging must not break the primary user operation.
  }
}
