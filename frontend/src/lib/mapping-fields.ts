import type { MappingRules } from "./types";

export const MAPPING_FIELDS = [
  { key: "document_title", label: "Document Title", group: "Document" },
  { key: "document_subtitle", label: "Document Subtitle", group: "Document" },
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

/**
 * Smart-match a markdown field key to the best Word style from the template.
 */
export function bestStyleMatch(fieldKey: string, styles: string[]): string {
  const lower = styles.map((s) => ({ original: s, lower: s.toLowerCase() }));

  function find(...patterns: string[]): string {
    for (const p of patterns) {
      const pl = p.toLowerCase();
      const exact = lower.find((s) => s.lower === pl);
      if (exact) return exact.original;
    }
    for (const p of patterns) {
      const pl = p.toLowerCase();
      const starts = lower.find((s) => s.lower.startsWith(pl));
      if (starts) return starts.original;
    }
    for (const p of patterns) {
      const pl = p.toLowerCase();
      const contains = lower.find((s) => s.lower.includes(pl));
      if (contains) return contains.original;
    }
    return "";
  }

  switch (fieldKey) {
    case "document_title":
      return find("Cover heading", "Title", "Document Title", "Cover Title");
    case "document_subtitle":
      return find("Cover Subtitle", "Subtitle", "Cover sub", "Document Subtitle");
    case "heading.1":
      return find("Heading 1", "heading1", "H1");
    case "heading.2":
      return find("Heading 2", "heading2", "H2");
    case "heading.3":
      return find("Heading 3", "heading3", "H3");
    case "heading.4":
      return find("Heading 4", "heading4", "H4");
    case "heading.5":
      return find("Heading 5", "heading5", "H5");
    case "heading.6":
      return find("Heading 6", "heading6", "H6");
    case "paragraph":
      return find("Normal", "Body Text", "Body", "Paragraph");
    case "list_bullet":
      return find("List Bullet", "Bullet List", "Bullet");
    case "list_bullet_2":
      return find("List Bullet 2", "List Bullet2", "Bullet 2");
    case "list_bullet_3":
      return find("List Bullet 3", "List Bullet3", "Bullet 3");
    case "list_ordered":
      return find("List Number", "List Numbered", "Numbered List", "Ordered");
    case "list_ordered_2":
      return find("List Number 2", "List Numbered 2", "Numbered 2");
    case "list_ordered_3":
      return find("List Number 3", "List Numbered 3", "Numbered 3");
    case "code_block":
      return find("Code", "Source Code", "Preformatted", "Code Block");
    case "blockquote":
      return find("Quote", "Block Text", "Blockquote", "Intense Quote");
    case "table.style":
      return find("Table Grid", "Table Normal", "Grid Table");
    default:
      return "";
  }
}

/** Flatten MappingRules into a flat Record<string, string> for editing */
export function flattenRules(r: MappingRules): Record<string, string> {
  const flat: Record<string, string> = {};
  if (r.heading) {
    Object.entries(r.heading).forEach(([k, v]) => {
      flat[`heading.${k}`] = v as string;
    });
  }
  flat.document_title = r.document_title || "";
  flat.document_subtitle = r.document_subtitle || "";
  flat.paragraph = r.paragraph || "";
  flat.list_bullet = r.list_bullet || "";
  flat.list_bullet_2 = r.list_bullet_2 || "";
  flat.list_bullet_3 = r.list_bullet_3 || "";
  flat.list_ordered = r.list_ordered || "";
  flat.list_ordered_2 = r.list_ordered_2 || "";
  flat.list_ordered_3 = r.list_ordered_3 || "";
  flat.code_block = r.code_block || "";
  flat.blockquote = r.blockquote || "";
  flat["table.style"] = r.table?.style || "";
  return flat;
}

/** Unflatten a flat Record<string, string> back into MappingRules */
export function unflattenRules(flat: Record<string, string>): MappingRules {
  return {
    heading: {
      "1": flat["heading.1"] || "Heading 1",
      "2": flat["heading.2"] || "Heading 2",
      "3": flat["heading.3"] || "Heading 3",
      "4": flat["heading.4"] || "Heading 4",
      "5": flat["heading.5"] || "Heading 5",
      "6": flat["heading.6"] || "Heading 6",
    },
    document_title: flat.document_title || "",
    document_subtitle: flat.document_subtitle || "",
    paragraph: flat.paragraph || "",
    list_bullet: flat.list_bullet || "",
    list_bullet_2: flat.list_bullet_2 || "",
    list_bullet_3: flat.list_bullet_3 || "",
    list_ordered: flat.list_ordered || "",
    list_ordered_2: flat.list_ordered_2 || "",
    list_ordered_3: flat.list_ordered_3 || "",
    code_block: flat.code_block || "",
    blockquote: flat.blockquote || "",
    table: {
      style: flat["table.style"] || "",
      header_row: true,
    },
    page_break_before: [],
    metadata_mapping: {},
  };
}
