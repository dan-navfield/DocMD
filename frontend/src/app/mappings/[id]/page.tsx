"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mappings as mappingsApi } from "@/lib/api";
import type { Mapping, MappingRules } from "@/lib/types";

const MAPPING_FIELDS = [
  { key: "heading.1", label: "Heading 1", group: "Headings" },
  { key: "heading.2", label: "Heading 2", group: "Headings" },
  { key: "heading.3", label: "Heading 3", group: "Headings" },
  { key: "heading.4", label: "Heading 4", group: "Headings" },
  { key: "heading.5", label: "Heading 5", group: "Headings" },
  { key: "heading.6", label: "Heading 6", group: "Headings" },
  { key: "paragraph", label: "Paragraph", group: "Body" },
  { key: "list_bullet", label: "Bullet List", group: "Lists" },
  { key: "list_bullet_2", label: "Bullet List (L2)", group: "Lists" },
  { key: "list_bullet_3", label: "Bullet List (L3)", group: "Lists" },
  { key: "list_ordered", label: "Ordered List", group: "Lists" },
  { key: "list_ordered_2", label: "Ordered List (L2)", group: "Lists" },
  { key: "list_ordered_3", label: "Ordered List (L3)", group: "Lists" },
  { key: "code_block", label: "Code Block", group: "Special" },
  { key: "blockquote", label: "Blockquote", group: "Special" },
  { key: "table.style", label: "Table Style", group: "Special" },
];

export default function MappingEditorPage() {
  const params = useParams();
  const router = useRouter();
  const mappingId = params.id as string;

  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mappingsApi.get(mappingId).then((m) => {
      setMapping(m);
      // Flatten rules for editing
      const flat: Record<string, string> = {};
      const r = m.rules as MappingRules;
      if (r.heading) {
        Object.entries(r.heading).forEach(([k, v]) => {
          flat[`heading.${k}`] = v;
        });
      }
      flat.paragraph = r.paragraph || "Normal";
      flat.list_bullet = r.list_bullet || "List Bullet";
      flat.list_bullet_2 = r.list_bullet_2 || "List Bullet 2";
      flat.list_bullet_3 = r.list_bullet_3 || "List Bullet 3";
      flat.list_ordered = r.list_ordered || "List Number";
      flat.list_ordered_2 = r.list_ordered_2 || "List Number 2";
      flat.list_ordered_3 = r.list_ordered_3 || "List Number 3";
      flat.code_block = r.code_block || "Code";
      flat.blockquote = r.blockquote || "Quote";
      flat["table.style"] = r.table?.style || "Table Grid";
      setRules(flat);
    });
  }, [mappingId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newRules = {
        heading: {
          "1": rules["heading.1"] || "Heading 1",
          "2": rules["heading.2"] || "Heading 2",
          "3": rules["heading.3"] || "Heading 3",
          "4": rules["heading.4"] || "Heading 4",
          "5": rules["heading.5"] || "Heading 5",
          "6": rules["heading.6"] || "Heading 6",
        },
        paragraph: rules.paragraph,
        list_bullet: rules.list_bullet,
        list_bullet_2: rules.list_bullet_2,
        list_bullet_3: rules.list_bullet_3,
        list_ordered: rules.list_ordered,
        list_ordered_2: rules.list_ordered_2,
        list_ordered_3: rules.list_ordered_3,
        code_block: rules.code_block,
        blockquote: rules.blockquote,
        table: {
          style: rules["table.style"],
          header_row: true,
        },
        page_break_before: [],
        metadata_mapping: {},
      };
      await mappingsApi.update(mappingId, { rules: newRules as unknown as MappingRules });
      router.push("/mappings");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!mapping) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const groups = [...new Set(MAPPING_FIELDS.map((f) => f.group))];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/mappings")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{mapping.name}</h1>
          <p className="text-sm text-slate-500">v{mapping.version} — Edit mapping rules</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MAPPING_FIELDS.filter((f) => f.group === group).map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <label className="w-40 text-sm text-slate-600">{field.label}</label>
                <Input
                  value={rules[field.key] || ""}
                  onChange={(e) =>
                    setRules((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder="Word style name"
                  className="flex-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
