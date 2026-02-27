"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Template, Mapping, Conversion } from "@/lib/types";

interface ConversionToolbarProps {
  templates: Template[];
  mappings: Mapping[];
  selectedTemplate: string;
  selectedMapping: string;
  onTemplateChange: (id: string) => void;
  onMappingChange: (id: string) => void;
  conversion: Conversion | null;
  reconverting: boolean;
  onReconvert: () => void;
  onDownload: () => void;
  downloading: boolean;
  mappingPanelOpen: boolean;
  onToggleMappingPanel: () => void;
}

export function ConversionToolbar({
  templates,
  mappings,
  selectedTemplate,
  selectedMapping,
  onTemplateChange,
  onMappingChange,
  conversion,
  reconverting,
  onReconvert,
  onDownload,
  downloading,
  mappingPanelOpen,
  onToggleMappingPanel,
}: ConversionToolbarProps) {
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const stats = conversion?.conversion_report?.stats as Record<string, number> | undefined;
  const statsText = stats
    ? Object.entries(stats)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ")
    : null;

  const warnings = conversion?.warnings || [];

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Template dropdown */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500">Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="h-7 rounded border border-slate-200 bg-white px-2 text-xs"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Mapping dropdown */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500">Mapping</label>
          <select
            value={selectedMapping}
            onChange={(e) => onMappingChange(e.target.value)}
            className="h-7 rounded border border-slate-200 bg-white px-2 text-xs"
          >
            {mappings.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        {statsText && (
          <span className="text-xs text-slate-500 border-l border-slate-200 pl-3">
            {statsText}
          </span>
        )}

        {/* Warnings badge */}
        {warnings.length > 0 && (
          <button
            onClick={() => setWarningsExpanded(!warningsExpanded)}
            className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
          >
            <AlertTriangle className="h-3 w-3" />
            {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </button>
        )}

        <div className="flex-1" />

        {/* Style Mappings toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleMappingPanel}
          className="h-7 gap-1.5 text-xs"
        >
          <Settings2 className="h-3 w-3" />
          Style Mappings
          {mappingPanelOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>

        {/* Re-convert */}
        <Button
          variant="outline"
          size="sm"
          onClick={onReconvert}
          disabled={reconverting || !selectedTemplate || !selectedMapping}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${reconverting ? "animate-spin" : ""}`} />
          Re-convert
        </Button>

        {/* Download */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={downloading}
          className="h-7 gap-1.5 text-xs"
        >
          <Download className="h-3 w-3" />
          {downloading ? "..." : ".docx"}
        </Button>
      </div>

      {/* Expanded warnings */}
      {warningsExpanded && warnings.length > 0 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2">
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
