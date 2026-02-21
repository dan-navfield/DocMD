"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Filter, LayoutGrid, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { documents as docsApi } from "@/lib/api";
import type { DocMDDocument } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocMDDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchQuery) params.search = searchQuery;

    docsApi
      .list(params)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [statusFilter, searchQuery]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Hero CTA */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Convert Markdown to Word
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload or paste your Markdown, choose a template, and get a
              professionally styled Word document.
            </p>
          </div>
          <Link href="/documents?new=true">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              New Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-2 h-3.5 w-3.5" />
              Status {statusFilter && `· ${statusFilter}`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter("")}>All</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("received")}>Received</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("converted")}>Converted</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("exported")}>Exported</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Document List */}
      <div className="rounded-xl border bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-12 w-12 text-slate-300" />
            <h3 className="text-base font-medium text-slate-700">No documents yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload a Markdown file or paste content to get started.
            </p>
            <Link href="/documents?new=true" className="mt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Document
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-[1fr_120px_100px_100px] gap-4 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <span>Title</span>
              <span>Status</span>
              <span>Type</span>
              <span>Modified</span>
            </div>
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="grid grid-cols-[1fr_120px_100px_100px] gap-4 px-4 py-3 hover:bg-slate-50 transition-colors items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-900">
                      {doc.title}
                    </span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <StatusBadge status={doc.status} />
                <span className="text-sm text-slate-500">{doc.doc_type || "—"}</span>
                <span className="text-sm text-slate-500">{timeAgo(doc.updated_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
