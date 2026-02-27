"use client";

import { usePathname } from "next/navigation";
import { IconNav } from "@/components/layout/icon-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Chromeless routes render without the app shell (nav sidebar)
  const chromelessRoutes = ["/login", "/signup", "/onboarding"];
  if (chromelessRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <IconNav />
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
