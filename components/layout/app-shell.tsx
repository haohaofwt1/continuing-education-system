import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <Sidebar initialRole={session?.user?.role} />
      <div className="lg:pl-72">
        <Topbar initialRole={session?.user?.role} userName={session?.user?.name} userEmail={session?.user?.email} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
