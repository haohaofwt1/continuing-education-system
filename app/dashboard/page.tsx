import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { auth } from "@/lib/auth";
import { isEmployeeRole } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (isEmployeeRole(session?.user?.role)) {
    redirect("/portal");
  }
  return <DashboardClient />;
}
