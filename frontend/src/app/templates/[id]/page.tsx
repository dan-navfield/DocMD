"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  LayoutTemplate,
  Palette,
  Pencil,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { templates as templatesApi } from "@/lib/api";
import { useFontBridge } from "@/hooks/use-font-bridge";
import { OnlyofficeEditor } from "@/components/onlyoffice-editor";
import { FontLibrary } from "@/components/font-library";
import { toast } from "sonner";
import type { Template } from "@/lib/types";

type PreviewMode = "docx" | "pdf" | "edit";
type DetailTab = "info" | "styles" | "fonts";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [usedStyles, setUsedStyles] = useState<string[]>([]);
  const [docxData, setDocxData] = useState<ArrayBuffer | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("docx");
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [detailsOpen, setDetailsOpen] = useState(true);

  // Style Map state
  const [showStyleMap, setShowStyleMap] = useState(false);
  const [styleMapLoading, setStyleMapLoading] = useState(false);
  const [styleMapData, setStyleMapData] = useState<{ index: number; text: string; style: string }[] | null>(null);

  // ONLYOFFICE editor state (edit mode only)
  const [editorConfig, setEditorConfig] = useState<Record<string, unknown> | null>(null);
  const [onlyofficeUrl, setOnlyofficeUrl] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(true);
  const [editorError, setEditorError] = useState<string | null>(null);

  // docx-preview state
  const previewRef = useRef<HTMLDivElement>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Use shared font bridge hook
  const fontBridge = useFontBridge();

  // Fetch template metadata + styles
  useEffect(() => {
    templatesApi.get(templateId).then(setTemplate).catch(() => toast.error("Failed to load template"));
    templatesApi
      .getStyles(templateId)
      .then((r) => {
        setStyles(r.styles);
        setUsedStyles(r.used_styles);
      })
      .catch(() => toast.error("Failed to load template styles"));
  }, [templateId]);

  // Background: fetch .docx data for download + docx-preview
  useEffect(() => {
    templatesApi
      .download(templateId)
      .then(setDocxData)
      .catch(() => toast.error("Failed to download template file"));
  }, [templateId]);

  // Background: fetch PDF preview via LibreOffice
  useEffect(() => {
    setLoadingPdf(true);
    templatesApi
      .preview(templateId)
      .then(setPdfUrl)
      .catch(() => toast.error("Failed to generate PDF preview"))
      .finally(() => setLoadingPdf(false));
  }, [templateId]);

  // Background: fetch ONLYOFFICE editor config (edit mode only)
  useEffect(() => {
    let cancelled = false;

    templatesApi
      .getOnlyofficeConfig(templateId)
      .then((data) => {
        if (!cancelled) {
          setEditorConfig(data.config);
          setOnlyofficeUrl(data.onlyoffice_url);
          setEditorLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEditorError(
            err instanceof Error ? err.message : "Failed to load editor config"
          );
          setEditorLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Render docx-preview when data and fonts are ready
  useEffect(() => {
    if (!docxData || !fontBridge.fontsLoaded || !previewRef.current) return;
    if (previewMode !== "docx") return;

    let cancelled = false;
    setLoadingPreview(true);

    // Clear previous render
    previewRef.current.innerHTML = "";

    import("docx-preview").then(({ renderAsync }) => {
      if (cancelled || !previewRef.current) return;
      renderAsync(docxData, previewRef.current, undefined, {
        className: "docx-preview-wrapper",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
      })
        .then(() => {
          if (cancelled || !previewRef.current) return;
          // Inject @font-face rules inside the docx-preview wrapper
          if (fontBridge.fontCssRules) {
            const wrapperStyle = document.createElement("style");
            wrapperStyle.textContent = fontBridge.fontCssRules;
            previewRef.current.prepend(wrapperStyle);
          }

          // Bridge fonts using shared utility
          fontBridge.bridgeFonts(previewRef.current);

          setLoadingPreview(false);
        })
        .catch(() => {
          toast.error("Failed to render document preview");
          if (!cancelled) setLoadingPreview(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [docxData, fontBridge.fontsLoaded, previewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // DOM-based style map overlay — applies pastel backgrounds + labels on docx-preview paragraphs
  useEffect(() => {
    if (!showStyleMap || !styleMapData || !previewRef.current || loadingPreview) return;

    const container = previewRef.current;
    const paragraphs = container.querySelectorAll<HTMLElement>(
      ".docx-preview-wrapper p, .docx-preview-wrapper h1, .docx-preview-wrapper h2, .docx-preview-wrapper h3, .docx-preview-wrapper h4, .docx-preview-wrapper h5, .docx-preview-wrapper h6, .docx-preview-wrapper li"
    );

    const labels: HTMLElement[] = [];
    const originalStyles: { el: HTMLElement; bg: string; pos: string; pb: string }[] = [];

    styleMapData.forEach((entry, i) => {
      const el = paragraphs[i];
      if (!el) return;

      const color = getStyleColor(entry.style);

      originalStyles.push({
        el,
        bg: el.style.backgroundColor,
        pos: el.style.position,
        pb: el.style.paddingBottom,
      });

      el.style.backgroundColor = color.bg;
      el.style.position = "relative";
      el.style.paddingBottom = "1.2em";

      const label = document.createElement("span");
      label.setAttribute("data-style-label", "true");
      label.textContent = entry.style;
      label.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        font-size: 9px;
        font-family: system-ui, sans-serif;
        padding: 1px 5px;
        border-radius: 3px;
        background-color: ${color.border};
        color: ${color.label};
        pointer-events: none;
        white-space: nowrap;
        line-height: 1.4;
      `;
      el.appendChild(label);
      labels.push(label);
    });

    return () => {
      labels.forEach((l) => l.remove());
      originalStyles.forEach(({ el, bg, pos, pb }) => {
        el.style.backgroundColor = bg;
        el.style.position = pos;
        el.style.paddingBottom = pb;
      });
    };
  }, [showStyleMap, styleMapData, loadingPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup PDF blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleDownload = async () => {
    if (!docxData || !template) return;
    const blob = new Blob([docxData], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this template?")) return;
    try {
      await templatesApi.delete(templateId);
      router.push("/templates");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleEditorSaved = () => {
    templatesApi.get(templateId).then(setTemplate).catch(() => toast.error("Failed to refresh template"));
    setDocxData(null);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoadingPdf(true);
    templatesApi
      .download(templateId)
      .then(setDocxData)
      .catch(() => toast.error("Failed to download updated template"));
    templatesApi
      .preview(templateId)
      .then(setPdfUrl)
      .catch(() => toast.error("Failed to regenerate PDF preview"))
      .finally(() => setLoadingPdf(false));
  };

  // Style Map: deterministic color assignment
  const STYLE_COLORS = [
    { bg: "#fff1f2", label: "#9f1239", border: "#fecdd3" },
    { bg: "#e0f2fe", label: "#075985", border: "#bae6fd" },
    { bg: "#fef3c7", label: "#92400e", border: "#fde68a" },
    { bg: "#ede9fe", label: "#5b21b6", border: "#ddd6fe" },
    { bg: "#ecfccb", label: "#3f6212", border: "#d9f99d" },
    { bg: "#fce7f3", label: "#9d174d", border: "#fbcfe8" },
    { bg: "#ccfbf1", label: "#115e59", border: "#99f6e4" },
    { bg: "#fef9c3", label: "#854d0e", border: "#fef08a" },
    { bg: "#e0e7ff", label: "#3730a3", border: "#c7d2fe" },
    { bg: "#f0fdf4", label: "#166534", border: "#bbf7d0" },
    { bg: "#fff7ed", label: "#9a3412", border: "#fed7aa" },
    { bg: "#f5f3ff", label: "#6d28d9", border: "#e9d5ff" },
  ];

  const getStyleColor = useCallback((styleName: string) => {
    let hash = 0;
    for (let i = 0; i < styleName.length; i++) {
      hash = ((hash << 5) - hash + styleName.charCodeAt(i)) | 0;
    }
    return STYLE_COLORS[Math.abs(hash) % STYLE_COLORS.length];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleStyleMap = useCallback(async () => {
    if (showStyleMap) {
      setShowStyleMap(false);
      return;
    }

    let data = styleMapData;
    if (!data) {
      setStyleMapLoading(true);
      try {
        const result = await templatesApi.getStyleMap(templateId);
        data = result.paragraphs;
        setStyleMapData(data);
      } catch {
        setStyleMapLoading(false);
        return;
      }
      setStyleMapLoading(false);
    }
    setShowStyleMap(true);
  }, [showStyleMap, styleMapData, templateId]);

  if (!template) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
      </div>
    );
  }

  const usedSet = new Set(usedStyles);
  const usedStylesList = styles.filter((s) => usedSet.has(s));
  const unusedStylesList = styles.filter((s) => !usedSet.has(s));
  const allSorted = [...usedStylesList, ...unusedStylesList];
  const visibleStyles = showAllStyles ? allSorted : allSorted.slice(0, 20);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/templates")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94908a] hover:bg-[#edebe0] hover:text-[#6b665e]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <LayoutTemplate className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#3b432f]">{template.name}</h1>
          <p className="text-sm text-[#94908a]">
            {template.description || "No description"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPreviewMode("edit")}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!docxData}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download .docx
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Template details — collapsible tabbed card */}
      <Card>
        <div className="flex items-center border-b bg-[#fdfcf5] px-4 pt-2">
          <div className="flex items-center gap-1 flex-1">
            {([
              { id: "info" as DetailTab, label: "Info", icon: Info },
              { id: "styles" as DetailTab, label: usedStyles.length > 0 ? `Styles (${usedStyles.length} used / ${styles.length})` : `Styles (${styles.length})`, icon: Palette },
              { id: "fonts" as DetailTab, label: "Fonts", icon: Type },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setDetailTab(tab.id);
                  if (!detailsOpen) setDetailsOpen(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  detailTab === tab.id && detailsOpen
                    ? "border-[#4c573e] text-[#3b432f]"
                    : "border-transparent text-[#94908a] hover:text-[#44403a]"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#94908a] hover:bg-[#edebe0] hover:text-[#6b665e] transition-colors"
          >
            {detailsOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        <div
          className={cn(
            "grid transition-all duration-200 ease-in-out",
            detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="max-h-[280px] overflow-auto p-6">
              {detailTab === "info" && (
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <span className="text-[#94908a]">Version</span>
                    <p className="font-medium">v{template.version}</p>
                  </div>
                  <div>
                    <span className="text-[#94908a]">Created</span>
                    <p className="font-medium">
                      {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#94908a]">Last updated</span>
                    <p className="font-medium">
                      {new Date(template.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {detailTab === "styles" && (
                styles.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleStyles.map((s) => {
                        const isUsed = usedSet.has(s);
                        return (
                          <Badge
                            key={s}
                            variant="outline"
                            className={cn(
                              "text-xs font-normal",
                              isUsed
                                ? "border-[#d8db6e] bg-[#fafd99]/10 text-[#3b432f]"
                                : "border-[#dddacc] bg-[#fdfcf5] text-[#94908a]"
                            )}
                          >
                            {s}
                          </Badge>
                        );
                      })}
                    </div>
                    {usedStylesList.length > 0 && unusedStylesList.length > 0 && visibleStyles.length > usedStylesList.length && (
                      <div className="my-2 border-t border-[#edebe0]" />
                    )}
                    {allSorted.length > 20 && (
                      <button
                        onClick={() => setShowAllStyles(!showAllStyles)}
                        className="mt-2 text-xs text-[#4c573e] hover:underline"
                      >
                        {showAllStyles
                          ? "Show fewer"
                          : `+${allSorted.length - 20} more`}
                      </button>
                    )}
                  </>
                )
              )}

              {detailTab === "fonts" && (
                <FontLibrary compact />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Document Preview */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#edebe0] bg-[#fdfcf5] py-3">
          <CardTitle className="text-base">Template Preview</CardTitle>
          <div className="flex items-center gap-3">
            {previewMode === "docx" && (
              <button
                onClick={() => {
                  handleToggleStyleMap();
                }}
                disabled={styleMapLoading}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  showStyleMap
                    ? "border-violet-300 bg-violet-100 text-violet-700"
                    : "border-[#dddacc] bg-white text-[#6b665e] hover:bg-[#fdfcf5] hover:text-[#3b432f]",
                  styleMapLoading && "opacity-70 cursor-wait"
                )}
              >
                {styleMapLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : showStyleMap ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {styleMapLoading ? "Loading..." : "Style Map"}
              </button>
            )}
          <div className="flex items-center gap-1 rounded-lg bg-[#edebe0] p-0.5">
            <button
              onClick={() => setPreviewMode("docx")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                previewMode === "docx"
                  ? "bg-white text-[#3b432f] shadow-sm"
                  : "text-[#94908a] hover:text-[#44403a]"
              }`}
            >
              <FileText className="h-3 w-3" />
              DOCX
            </button>
            <button
              onClick={() => setPreviewMode("pdf")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                previewMode === "pdf"
                  ? "bg-white text-[#3b432f] shadow-sm"
                  : "text-[#94908a] hover:text-[#44403a]"
              }`}
            >
              <FileText className="h-3 w-3" />
              PDF
              {loadingPdf && (
                <div className="h-2 w-2 animate-spin rounded-full border border-[#94908a] border-t-transparent" />
              )}
            </button>
            <button
              onClick={() => setPreviewMode("edit")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                previewMode === "edit"
                  ? "bg-white text-[#3b432f] shadow-sm"
                  : "text-[#94908a] hover:text-[#44403a]"
              }`}
            >
              <Pencil className="h-3 w-3" />
              Edit
              {editorLoading && (
                <div className="h-2 w-2 animate-spin rounded-full border border-[#94908a] border-t-transparent" />
              )}
            </button>
          </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {previewMode === "docx" && (
            <div className="flex">
              {/* Style Map side panel */}
              {showStyleMap && styleMapData && (
                <div className="w-[300px] shrink-0 border-r border-[#dddacc] bg-[#fdfcf5] overflow-auto" style={{ maxHeight: "800px" }}>
                  <div className="sticky top-0 z-10 border-b border-[#dddacc] bg-[#edebe0] px-3 py-2">
                    <h3 className="text-xs font-semibold text-[#6b665e] uppercase tracking-wide">Style Map</h3>
                    <p className="text-[10px] text-[#94908a] mt-0.5">{styleMapData.length} paragraphs</p>
                  </div>
                  <div className="divide-y divide-[#edebe0]">
                    {styleMapData.map((entry) => {
                      const color = getStyleColor(entry.style);
                      return (
                        <div key={entry.index} className="px-3 py-2 hover:bg-white transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-[#94908a] w-5 shrink-0 text-right">
                              {entry.index}
                            </span>
                            <span
                              className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate"
                              style={{
                                backgroundColor: color.border,
                                color: color.label,
                              }}
                            >
                              {entry.style}
                            </span>
                          </div>
                          {entry.text.trim() && (
                            <p className="text-[11px] text-[#94908a] leading-snug pl-7 truncate" title={entry.text}>
                              {entry.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* docx-preview container */}
              <div className="flex-1 min-w-0 overflow-auto" style={{ maxHeight: "800px" }}>
                {loadingPreview && (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
                    <span className="ml-3 text-sm text-[#94908a]">Rendering document...</span>
                  </div>
                )}
                <div
                  ref={previewRef}
                  className={cn(loadingPreview && "hidden")}
                />
              </div>
            </div>
          )}
          {previewMode === "pdf" && (
            loadingPdf ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
                <span className="ml-3 text-sm text-[#94908a]">Rendering PDF via LibreOffice...</span>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="h-[800px] w-full border-0"
                title="Template PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-[#94908a]">
                Failed to load PDF preview
              </div>
            )
          )}
          {previewMode === "edit" && (
            <OnlyofficeEditor
              config={editorConfig}
              onlyofficeUrl={onlyofficeUrl}
              loading={editorLoading}
              error={editorError}
              onClose={() => setPreviewMode("docx")}
              onSaved={handleEditorSaved}
              mode="edit"
              containerId="onlyoffice-editor-container"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
