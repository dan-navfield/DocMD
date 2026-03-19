"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { documents as docsApi } from "@/lib/api";
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
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  if (!pathname.startsWith("/documents") && pathname !== "/") {
    return null;
  }

  const handleNewDocument = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("title", "Untitled Document");
      formData.append("markdown", "# Untitled Document\n\nStart writing...");
      const newDoc = await docsApi.create(formData);
      router.push(`/documents/${newDoc.id}`);
    } catch (e) {
      toast.error("Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full w-56 flex-col border-r bg-white px-3 py-4">
      <div className="mb-4">
        <button
          onClick={handleNewDocument}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4c573e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3b432f] transition-colors disabled:opacity-50"
        >
          <FolderPlus className="h-4 w-4" />
          {creating ? "Creating..." : "New Document"}
        </button>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[#94908a]">
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
                  ? "bg-[#edebe0] text-[#3b432f] font-medium"
                  : "text-[#6b665e] hover:bg-[#fdfcf5] hover:text-[#3b432f]"
              )}
            >
              <view.icon className="h-4 w-4" />
              {view.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-[#94908a]">
          Projects
          <ChevronDown className="h-3 w-3" />
        </h3>
        <p className="px-2 text-xs text-[#94908a]">
          No projects yet
        </p>
      </div>

      <div>
        <h3 className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-[#94908a]">
          Tags
          <ChevronDown className="h-3 w-3" />
        </h3>
        <div className="flex flex-wrap gap-1 px-2">
          <span className="inline-flex items-center rounded-md bg-[#edebe0] px-2 py-0.5 text-xs text-[#6b665e]">
            <Tag className="mr-1 h-3 w-3" />
            architecture
          </span>
          <span className="inline-flex items-center rounded-md bg-[#edebe0] px-2 py-0.5 text-xs text-[#6b665e]">
            <Tag className="mr-1 h-3 w-3" />
            adr
          </span>
        </div>
      </div>
    </div>
  );
}
