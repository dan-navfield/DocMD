"use client";

import { ChevronDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAPPING_FIELDS } from "@/lib/mapping-fields";

interface InlineMappingPanelProps {
  rules: Record<string, string>;
  styles: string[];
  onChange: (key: string, value: string) => void;
  open: boolean;
  onSave?: () => void;
  saving?: boolean;
}

export function InlineMappingPanel({
  rules,
  styles,
  onChange,
  open,
  onSave,
  saving = false,
}: InlineMappingPanelProps) {
  if (!open) return null;

  const groups = [...new Set(MAPPING_FIELDS.map((f) => f.group))];
  const hasStyles = styles.length > 0;

  return (
    <div className="border-t border-[#dddacc] bg-[#fdfcf5] px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#6b665e] uppercase tracking-wide">
          Style Mappings
        </h3>
        {onSave && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="h-7 gap-1.5 text-xs"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save Mapping"}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 text-[10px] font-semibold text-[#94908a] uppercase tracking-wider">
              {group}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {MAPPING_FIELDS.filter((f) => f.group === group).map((field) => {
                const value = rules[field.key] || "";
                const valueInStyles = hasStyles && styles.includes(value);
                const isCustomValue = hasStyles && value && !valueInStyles;

                return (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="w-28 shrink-0 text-[11px] text-[#94908a] truncate" title={field.label}>
                      {field.label}
                    </label>
                    {hasStyles ? (
                      <div className="relative flex-1">
                        <select
                          value={value}
                          onChange={(e) => onChange(field.key, e.target.value)}
                          className={`h-7 w-full appearance-none rounded border bg-white px-2 pr-6 text-[11px] shadow-sm transition-colors focus:border-[#4c573e] focus:outline-none focus:ring-1 focus:ring-[#4c573e] ${
                            isCustomValue
                              ? "border-amber-300 text-amber-700"
                              : value
                                ? "border-[#dddacc] text-[#3b432f]"
                                : "border-[#dddacc] text-[#94908a]"
                          }`}
                        >
                          <option value="">-- Select --</option>
                          {isCustomValue && (
                            <option value={value}>{value} (custom)</option>
                          )}
                          {styles.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[#94908a]" />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        placeholder="Style name"
                        className="h-7 flex-1 rounded border border-[#dddacc] bg-white px-2 text-[11px] shadow-sm placeholder:text-[#94908a] focus:border-[#4c573e] focus:outline-none focus:ring-1 focus:ring-[#4c573e]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
