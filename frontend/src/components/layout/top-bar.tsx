"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, HelpCircle, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Documents", href: "/documents" },
  { label: "Templates", href: "/templates" },
  { label: "Mappings", href: "/mappings" },
  { label: "Projects", href: "/projects" },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <div className="flex h-14 items-center justify-between border-b bg-white px-6">
      <nav className="flex items-center gap-6">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative pb-0.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-sm"
          />
        </div>
        <Link
          href="/settings"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            pathname.startsWith("/settings")
              ? "bg-emerald-100 text-emerald-700"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          )}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
