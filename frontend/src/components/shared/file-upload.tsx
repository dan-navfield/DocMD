"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  label?: string;
  className?: string;
}

export function FileUpload({
  accept = ".md,.markdown",
  onFileSelect,
  label = "Upload file",
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragActive
          ? "border-[#6b7f5a] bg-[#fafd99]/10"
          : "border-[#dddacc] hover:border-[#dddacc]",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {selectedFile ? (
        <div className="flex items-center justify-center gap-2">
          <FileText className="h-5 w-5 text-[#4c573e]" />
          <span className="text-sm font-medium">{selectedFile.name}</span>
          <button
            onClick={() => setSelectedFile(null)}
            className="ml-2 rounded-full p-0.5 text-[#94908a] hover:bg-[#edebe0] hover:text-[#3b432f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="mx-auto mb-2 h-8 w-8 text-[#94908a]" />
          <p className="text-sm text-[#6b665e]">{label}</p>
          <p className="mt-1 text-xs text-[#94908a]">
            Drag and drop or click to browse
          </p>
        </>
      )}
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}
