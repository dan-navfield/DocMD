"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mappings as mappingsApi, templates as templatesApi } from "@/lib/api";
import { MAPPING_FIELDS, bestStyleMatch, flattenRules, unflattenRules } from "@/lib/mapping-fields";
import { toast } from "sonner";
import type { Mapping } from "@/lib/types";

export default function MappingEditorPage() {
  const params = useParams();
  const router = useRouter();
  const mappingId = params.id as string;

  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [styles, setStyles] = useState<string[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mappingsApi.get(mappingId).then((m) => {
      setMapping(m);
      const flat = flattenRules(m.rules);
      setRules(flat);

      // Fetch styles from the linked template
      if (m.template_id) {
        setLoadingStyles(true);
        templatesApi
          .getStyles(m.template_id)
          .then((res) => {
            setStyles(res.styles);
            // Auto-match empty fields to best style matches
            setRules((prev) => {
              const updated = { ...prev };
              for (const field of MAPPING_FIELDS) {
                if (!updated[field.key]) {
                  const match = bestStyleMatch(field.key, res.styles);
                  if (match) updated[field.key] = match;
                }
              }
              return updated;
            });
          })
          .catch(() => toast.error("Failed to load template styles"))
          .finally(() => setLoadingStyles(false));
      }
    });
  }, [mappingId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newRules = unflattenRules(rules);
      await mappingsApi.update(mappingId, { rules: newRules });
      router.push("/mappings");
    } catch {
      toast.error("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  };

  if (!mapping) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
      </div>
    );
  }

  const groups = [...new Set(MAPPING_FIELDS.map((f) => f.group))];
  const hasStyles = styles.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/mappings")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94908a] hover:bg-[#edebe0]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#3b432f]">{mapping.name}</h1>
          <p className="text-sm text-[#94908a]">v{mapping.version} — Edit mapping rules</p>
        </div>
        <Button
          className="bg-[#4c573e] hover:bg-[#3b432f]"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {!mapping.template_id && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This mapping has no linked template. Link a template to see available Word styles as dropdown options.
        </div>
      )}

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MAPPING_FIELDS.filter((f) => f.group === group).map((field) => {
              const value = rules[field.key] || "";
              const valueInStyles = hasStyles && styles.includes(value);
              const isCustomValue = hasStyles && value && !valueInStyles;

              return (
                <div key={field.key} className="flex items-center gap-4">
                  <label className="w-40 shrink-0 text-sm text-[#6b665e]">
                    {field.label}
                  </label>
                  {hasStyles ? (
                    <div className="relative flex-1">
                      <select
                        value={value}
                        onChange={(e) =>
                          setRules((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className={`h-9 w-full appearance-none rounded-md border bg-white px-3 pr-8 text-sm shadow-sm transition-colors focus:border-[#4c573e] focus:outline-none focus:ring-1 focus:ring-[#4c573e] ${
                          isCustomValue
                            ? "border-amber-300 text-amber-700"
                            : value
                              ? "border-[#dddacc] text-[#3b432f]"
                              : "border-[#dddacc] text-[#94908a]"
                        }`}
                      >
                        <option value="">— Select style —</option>
                        {isCustomValue && (
                          <option value={value}>{value} (custom)</option>
                        )}
                        {styles.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-[#94908a]" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setRules((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={loadingStyles ? "Loading styles..." : "Word style name"}
                      disabled={loadingStyles}
                      className="h-9 flex-1 rounded-md border border-[#dddacc] bg-white px-3 text-sm shadow-sm transition-colors placeholder:text-[#94908a] focus:border-[#4c573e] focus:outline-none focus:ring-1 focus:ring-[#4c573e] disabled:opacity-50"
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
