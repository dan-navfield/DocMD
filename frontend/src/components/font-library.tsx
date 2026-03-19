"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Type,
  FileText,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fonts as fontsApi } from "@/lib/api";
import type { Font } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPTED = ".ttf,.otf,.woff,.woff2,.zip";

type UploadJob = {
  id: string;
  label: string;
  status: "queued" | "uploading" | "done" | "error";
  files: File[];
  fontCount?: number;
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jobLabel(files: File[]): string {
  if (files.length === 1) return files[0].name;
  return `${files.length} files`;
}

let jobIdCounter = 0;

export function FontLibrary({ compact = false }: { compact?: boolean }) {
  const [fontList, setFontList] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const fetchFonts = useCallback(async () => {
    try {
      const data = await fontsApi.list();
      setFontList(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  // Process the queue — runs whenever jobs change
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    // We need to read jobs from the state inside a loop, so use a helper
    const getNextQueued = (): UploadJob | undefined => {
      let found: UploadJob | undefined;
      // Use the setter to peek at current state without stale closure
      setJobs((prev) => {
        found = prev.find((j) => j.status === "queued");
        return prev;
      });
      return found;
    };

    let next = getNextQueued();
    while (next) {
      const jobId = next.id;
      const files = next.files;

      // Mark as uploading
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "uploading" } : j))
      );

      try {
        const result = await fontsApi.upload(files);
        setFontList((prev) => [...result.fonts, ...prev]);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: "done", fontCount: result.fonts.length }
              : j
          )
        );
      } catch (e) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "error",
                  error: e instanceof Error ? e.message : "Upload failed",
                }
              : j
          )
        );
      }

      next = getNextQueued();
    }

    processingRef.current = false;
  }, []);

  // Kick off processing whenever jobs list changes
  useEffect(() => {
    if (jobs.some((j) => j.status === "queued")) {
      processQueue();
    }
  }, [jobs, processQueue]);

  // Auto-clear completed/errored jobs after 5s
  useEffect(() => {
    const doneJobs = jobs.filter(
      (j) => j.status === "done" || j.status === "error"
    );
    if (doneJobs.length === 0) return;

    const timer = setTimeout(() => {
      setJobs((prev) =>
        prev.filter((j) => j.status === "queued" || j.status === "uploading")
      );
    }, 5000);
    return () => clearTimeout(timer);
  }, [jobs]);

  const enqueueUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newJob: UploadJob = {
      id: String(++jobIdCounter),
      label: jobLabel(fileArray),
      status: "queued",
      files: fileArray,
    };

    setJobs((prev) => [...prev, newJob]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this font?")) return;
    try {
      await fontsApi.delete(id);
      setFontList((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // fail silently
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) enqueueUpload(e.dataTransfer.files);
  };

  const activeJobs = jobs.filter(
    (j) => j.status !== "done" || jobs.indexOf(j) >= jobs.length - 3
  );
  const visibleJobs = jobs.length > 0 ? jobs : [];

  // ── Compact layout (template page) ──
  if (compact) {
    return (
      <div className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 transition-colors",
            dragOver
              ? "border-[#6b7f5a] bg-[#fafd99]/10"
              : "border-[#dddacc] hover:border-[#dddacc]"
          )}
        >
          <Upload className="h-4 w-4 text-[#94908a]" />
          <span className="text-xs text-[#94908a]">
            Drop font files or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-[#4c573e] hover:underline"
            >
              browse
            </button>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && enqueueUpload(e.target.files)}
          />
        </div>

        {/* Job status list */}
        {visibleJobs.length > 0 && (
          <div className="space-y-1">
            {visibleJobs.map((job) => (
              <JobStatusRow key={job.id} job={job} size="sm" />
            ))}
          </div>
        )}

        {/* Font list */}
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-[#94908a]" />
          </div>
        ) : fontList.length === 0 ? (
          <p className="text-center text-xs text-[#94908a] py-2">
            No fonts uploaded yet
          </p>
        ) : (
          <div className="space-y-1">
            {fontList.map((font) => (
              <div
                key={font.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-[#fdfcf5]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Type className="h-3.5 w-3.5 shrink-0 text-[#94908a]" />
                  <span className="truncate text-xs font-medium text-[#44403a]">
                    {font.name}
                  </span>
                  <span className="text-xs text-[#94908a]">
                    {formatBytes(font.file_size_bytes)}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(font.id)}
                  className="shrink-0 p-1 text-[#94908a] hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Full-size layout (Settings page) ──
  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="rounded-xl border border-[#dddacc] bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-[#3b432f]">Upload Fonts</h2>
          <p className="mt-0.5 text-xs text-[#94908a]">
            Upload .ttf, .otf, .woff, or .woff2 files to make them available in
            templates
          </p>
        </div>
        <div className="p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
              dragOver
                ? "border-[#6b7f5a] bg-[#fafd99]/10"
                : "border-[#dddacc] hover:border-[#dddacc]"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edebe0]">
              <Upload className="h-5 w-5 text-[#94908a]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#44403a]">
                Drop font files here or{" "}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#4c573e] hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-[#94908a]">
                Supports TTF, OTF, WOFF, WOFF2, and ZIP archives
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && enqueueUpload(e.target.files)}
            />
          </div>

          {/* Upload queue status */}
          {visibleJobs.length > 0 && (
            <div className="mt-4 space-y-2">
              {visibleJobs.map((job) => (
                <JobStatusRow key={job.id} job={job} size="md" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Font list */}
      <div className="rounded-xl border border-[#dddacc] bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-[#3b432f]">
            Installed Fonts ({fontList.length})
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#94908a]" />
          </div>
        ) : fontList.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Type className="mx-auto h-8 w-8 text-[#94908a]" />
            <p className="mt-2 text-sm text-[#94908a]">No fonts uploaded yet</p>
            <p className="text-xs text-[#94908a]">
              Upload font files above to get started
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {fontList.map((font) => (
              <div
                key={font.id}
                className="flex items-center justify-between px-6 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edebe0]">
                    <FileText className="h-4 w-4 text-[#94908a]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#3b432f]">
                      {font.name}
                    </p>
                    <p className="text-xs text-[#94908a]">
                      {font.filename} &middot; {formatBytes(font.file_size_bytes)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(font.id)}
                  className="text-[#94908a] hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobStatusRow({ job, size }: { job: UploadJob; size: "sm" | "md" }) {
  const isSmall = size === "sm";
  const iconCls = isSmall ? "h-3.5 w-3.5" : "h-4 w-4";
  const textCls = isSmall ? "text-xs" : "text-sm";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3",
        isSmall ? "py-1.5" : "py-2",
        job.status === "done" && "bg-[#fafd99]/10 border border-[#d8db6e]",
        job.status === "error" && "bg-red-50 border border-red-200",
        job.status === "uploading" && "bg-blue-50 border border-blue-200",
        job.status === "queued" && "bg-[#fdfcf5] border border-[#dddacc]"
      )}
    >
      {job.status === "queued" && (
        <Package className={cn(iconCls, "text-[#94908a]")} />
      )}
      {job.status === "uploading" && (
        <Loader2 className={cn(iconCls, "animate-spin text-blue-500")} />
      )}
      {job.status === "done" && (
        <CheckCircle className={cn(iconCls, "text-[#4c573e]")} />
      )}
      {job.status === "error" && (
        <AlertCircle className={cn(iconCls, "text-red-500")} />
      )}

      <span
        className={cn(
          textCls,
          job.status === "done" && "text-[#3b432f]",
          job.status === "error" && "text-red-700",
          job.status === "uploading" && "text-blue-700",
          job.status === "queued" && "text-[#94908a]"
        )}
      >
        {job.status === "queued" && `Queued: ${job.label}`}
        {job.status === "uploading" && `Uploading ${job.label}...`}
        {job.status === "done" &&
          `${job.fontCount} font(s) installed from ${job.label}`}
        {job.status === "error" && `${job.label}: ${job.error}`}
      </span>
    </div>
  );
}
