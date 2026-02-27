"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { documents, conversions } from "@/lib/api";
import {
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const SAMPLE_MARKDOWN = `# Quarterly Report

## Executive Summary

This report covers Q1 performance across all departments. Revenue grew **12%** year-over-year.

## Key Highlights

- Customer base expanded to **2,400** active accounts
- Churn rate decreased to *1.8%*
- NPS score improved to 72

## Next Steps

1. Launch new onboarding flow
2. Expand to EU markets
3. Hire 5 additional engineers

> "The best quarter we've had since launch." — CEO

\`\`\`
Total Revenue: $1.2M
Growth Rate:   12% YoY
\`\`\`
`;

interface ConversionStepProps {
  templateId: string | null;
  mappingId: string | null;
  onNext: () => void;
}

export function ConversionStep({
  templateId,
  mappingId,
  onNext,
}: ConversionStepProps) {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const canConvert = templateId && mappingId;

  const handleConvert = async () => {
    if (!templateId || !mappingId) return;
    setConverting(true);
    setError("");

    try {
      // Create a document from markdown
      const formData = new FormData();
      const blob = new Blob([markdown], { type: "text/markdown" });
      formData.append("file", blob, "onboarding-sample.md");
      formData.append("title", "Onboarding Sample");

      const doc = await documents.create(formData);

      // Convert the document
      const conversion = await conversions.convert(
        doc.id,
        templateId,
        mappingId
      );
      setConversionId(conversion.id);
      setConverted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = async () => {
    if (!conversionId) return;
    setDownloading(true);
    try {
      const blob = await conversions.download(conversionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "onboarding-sample.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-slate-900">
        Try your first conversion
      </h2>
      <p className="mt-2 text-sm text-slate-500 text-center max-w-md">
        {canConvert
          ? "Edit the sample markdown below, then convert it to a Word document."
          : "You can try a conversion after setting up a template and mapping."}
      </p>

      <div className="mt-6 w-full max-w-lg">
        {!canConvert && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              A template and mapping are needed for conversion. You can set
              these up later from the dashboard.
            </p>
          </div>
        )}

        {converted ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <p className="font-medium text-emerald-800">
              Document converted successfully!
            </p>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download .docx
            </Button>
          </div>
        ) : (
          <>
            {/* Template + Mapping badges */}
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  templateId
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <FileText className="h-3 w-3" />
                {templateId ? "Template selected" : "No template"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  mappingId
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {mappingId ? "Mapping selected" : "No mapping"}
              </span>
            </div>

            {/* Markdown editor */}
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="h-56 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
              placeholder="Paste your markdown here..."
            />
          </>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {canConvert && !converted && (
          <Button
            onClick={handleConvert}
            disabled={converting || !markdown.trim()}
            className="h-11 bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium px-8"
          >
            {converting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              "Convert"
            )}
          </Button>
        )}
        {(converted || !canConvert) && (
          <Button
            onClick={onNext}
            className="h-11 bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-medium px-8"
          >
            Continue
          </Button>
        )}
        {!converted && canConvert && (
          <button
            onClick={onNext}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
