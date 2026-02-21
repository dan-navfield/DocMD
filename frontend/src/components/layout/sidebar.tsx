"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  FileText,
  Clock,
  Users,
  AlertCircle,
  FolderPlus,
  Tag,
  ChevronDown,
} from "lucide-react";

const smartViews = [
  { label: "All", href: "/documents", icon: FileText },
  { label: "Recent", href: "/documents?filter=recent", icon: Clock },
  { label: "Shared with me", href: "/documents?filter=shared", icon: Users },
  { label: "Needs review", href: "/documents?status=received", icon: AlertCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  if (!pathname.startsWith("/documents") && pathname !== "/") {
    return null;
  }

  return (
    <div className="flex h-full w-56 flex-col border-r bg-white px-3 py-4">
      <div className="mb-4">
        <Link
          href="/documents?new=true"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <FolderPlus className="h-4 w-4" />
          New Document
        </Link>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Smart Views
        </h3>
        <nav className="flex flex-col gap-0.5">
          {smartViews.map((view) => (
            <Link
              key={view.href}
              href={view.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                pathname === view.href
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <view.icon className="h-4 w-4" />
              {view.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Projects
          <ChevronDown className="h-3 w-3" />
        </h3>
        <p className="px-2 text-xs text-slate-400">
          No projects yet
        </p>
      </div>

      <div>
        <h3 className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tags
          <ChevronDown className="h-3 w-3" />
        </h3>
        <div className="flex flex-wrap gap-1 px-2">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            <Tag className="mr-1 h-3 w-3" />
            architecture
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            <Tag className="mr-1 h-3 w-3" />
            adr
          </span>
        </div>
      </div>
    </div>
  );
}
