"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { templates, onboarding } from "@/lib/api";
import {
  GitBranch,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface MappingStepProps {
  templateId: string | null;
  onNext: (mappingId: string | null) => void;
}

export function MappingStep({ templateId, onNext }: MappingStepProps) {
  const [mappingName, setMappingName] = useState("Default Mapping");
  const [styles, setStyles] = useState<string[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!templateId) return;
    setLoadingStyles(true);
    templates
      .getStyles(templateId)
      .then((result) => setStyles(result.styles))
      .catch(() => {})
      .finally(() => setLoadingStyles(false));
  }, [templateId]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const result = await onboarding.seedMapping({
        template_id: templateId || undefined,
        name: mappingName,
      });
      setCreatedId(result.mapping_id);
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mapping");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-slate-900">
        Create your first mapping
      </h2>
      <p className="mt-2 text-sm text-slate-500 text-center max-w-md">
        {templateId
          ? "We'll auto-match your template's styles to Markdown elements."
          : "We'll create a mapping with sensible defaults. You can customise it later."}
      </p>

      <div className="mt-8 w-full max-w-md space-y-4">
        {created ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <p className="font-medium text-emerald-800">
              Mapping created successfully!
            </p>
            <p className="text-sm text-emerald-600">{mappingName}</p>
          </div>
        ) : (
          <>
            {/* Style preview if template was uploaded */}
            {templateId && styles.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">
                    Template styles detected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {styles.slice(0, 12).map((style) => (
                    <span
                      key={style}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {style}
                    </span>
                  ))}
                  {styles.length > 12 && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                      +{styles.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {loadingStyles && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">
                  Analyzing template styles...
                </span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Mapping name
              </label>
              <Input
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="Default Mapping"
                className="h-10"
              />
            </div>

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
        {!created && (
          <Button
            onClick={handleCreate}
            disabled={creating || !mappingName}
            className="h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-[#3b432f] text-sm font-medium px-8"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create mapping"
            )}
          </Button>
        )}
        {created && (
          <Button
            onClick={() => onNext(createdId)}
            className="h-11 bg-[#fafd99] hover:bg-[#f0f47a] text-[#3b432f] text-sm font-medium px-8"
          >
            Continue
          </Button>
        )}
        {!created && (
          <button
            onClick={() => onNext(null)}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
