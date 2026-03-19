"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { templates } from "@/lib/api";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

interface TemplateUploadStepProps {
  onNext: (templateId: string | null) => void;
}

export function TemplateUploadStep({ onNext }: TemplateUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!templateName) {
        setTemplateName(selected.name.replace(/\.docx$/i, ""));
      }
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", templateName || file.name.replace(/\.docx$/i, ""));
      if (description) formData.append("description", description);

      const result = await templates.create(formData);
      setUploadedId(result.id);
      setUploaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-[#3b432f]">
        Upload your first template
      </h2>
      <p className="mt-2 text-sm text-[#94908a] text-center max-w-md">
        Upload a .docx file with the styles you want your converted documents to
        use. You can always add more later.
      </p>

      <div className="mt-8 w-full max-w-md space-y-4">
        {uploaded ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#d8db6e] bg-[#fafd99]/10 p-6">
            <CheckCircle className="h-8 w-8 text-[#4c573e]" />
            <p className="font-medium text-[#3b432f]">
              Template uploaded successfully!
            </p>
            <p className="text-sm text-[#4c573e]">{templateName}</p>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#dddacc] p-8 transition hover:border-[#6b7f5a] hover:bg-[#fafd99]/10"
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-[#4c573e]" />
                  <div className="text-center">
                    <p className="font-medium text-[#3b432f]">{file.name}</p>
                    <p className="text-xs text-[#94908a]">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setTemplateName("");
                    }}
                    className="text-xs text-[#94908a] hover:text-[#6b665e]"
                  >
                    <X className="inline h-3 w-3 mr-0.5" />
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-[#94908a]" />
                  <div className="text-center">
                    <p className="font-medium text-[#44403a]">
                      Click to upload a .docx template
                    </p>
                    <p className="text-xs text-[#94908a]">
                      Word documents only (.docx)
                    </p>
                  </div>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />

            {file && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#44403a]">
                    Template name
                  </label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Company Report"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#44403a]">
                    Description{" "}
                    <span className="text-[#94908a]">(optional)</span>
                  </label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this template"
                    className="h-10"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {!uploaded && file && (
          <Button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-sm font-medium px-8"
            style={{ color: "#3b432f" }}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload & continue"
            )}
          </Button>
        )}
        {uploaded && (
          <Button
            onClick={() => onNext(uploadedId)}
            className="h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-sm font-medium px-8"
            style={{ color: "#3b432f" }}
          >
            Continue
          </Button>
        )}
        {!uploaded && (
          <button
            onClick={() => onNext(null)}
            className="text-sm text-[#94908a] hover:text-[#6b665e]"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
