"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutTemplate,
  GitBranch,
  FolderKanban,
  Home,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/templates", icon: LayoutTemplate, label: "Templates" },
  { href: "/mappings", icon: GitBranch, label: "Mappings" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
];

export function IconNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-14 flex-col items-center border-r bg-slate-50 py-4">
      <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
        MD
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div />
    </div>
  );
}
