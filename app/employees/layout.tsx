import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isEmployeeRole } from "@/lib/roles";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (isEmployeeRole(session?.user?.role)) redirect("/portal");
  return children;
}
