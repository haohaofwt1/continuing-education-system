import { auth } from "@/lib/auth";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { PermissionKey, can } from "@/lib/permissions";
import { isEmployeeRole } from "@/lib/roles";

export type RequestActor = {
  id?: string;
  tenantId?: string | null;
  email?: string | null;
  role?: string;
  permissions: string[];
  demoMode: boolean;
};

export async function requirePermission(permission: PermissionKey): Promise<RequestActor> {
  const session = await auth();
  const actor: RequestActor = {
    id: session?.user?.id,
    tenantId: session?.user?.tenantId,
    email: session?.user?.email,
    role: session?.user?.role,
    permissions: session?.user?.permissions ?? [],
    demoMode: !session?.user
  };

  if (actor.demoMode && isDemoFallbackEnabled()) return actor;
  if (actor.demoMode) {
    throw new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (can(actor.permissions, permission)) return actor;

  throw new Response(JSON.stringify({ error: "FORBIDDEN", permission }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
}

export function isEmployeeActor(actor: RequestActor) {
  return isEmployeeRole(actor.role);
}
