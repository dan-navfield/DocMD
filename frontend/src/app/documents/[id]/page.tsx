"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileOutput,
  FileText,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  SplitSquareHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocxPreviewPane } from "@/components/docx-preview-pane";
import { ConversionToolbar } from "@/components/conversion-toolbar";
import { InlineMappingPanel } from "@/components/inline-mapping-panel";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle, useDefaultLayout } from "react-resizable-panels";
import { useFontBridge } from "@/hooks/use-font-bridge";
import { flattenRules, unflattenRules, bestStyleMatch, MAPPING_FIELDS } from "@/lib/mapping-fields";
import {
  documents as docsApi,
  conversions as convApi,
  templates as templatesApi,
  mappings as mappingsApi,
  agent as agentApi,
} from "@/lib/api";
import type {
  DocMDDocument,
  Template,
  Mapping,
  Conversion,
  ClassifyResponse,
  MappingRules,
} from "@/lib/types";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MarkdownPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

type EditorMode = "preview" | "edit" | "split";
type Phase = "pre_convert" | "converting" | "post_convert";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  // Core document state
  const [doc, setDoc] = useState<DocMDDocument | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [savedMarkdown, setSavedMarkdown] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("preview");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Template/mapping selection
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allMappings, setAllMappings] = useState<Mapping[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedMapping, setSelectedMapping] = useState("");

  // Classification
  const [classification, setClassification] = useState<ClassifyResponse | null>(null);
  const [classifying, setClassifying] = useState(false);

  // Conversion state machine
  const [phase, setPhase] = useState<Phase>("pre_convert");
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [converting, setConverting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Post-convert state
  const [docxPreviewData, setDocxPreviewData] = useState<ArrayBuffer | null>(null);
  const [reconverting, setReconverting] = useState(false);
  const [mappingRules, setMappingRules] = useState<Record<string, string>>({});
  const [templateStyles, setTemplateStyles] = useState<string[]>([]);
  const [mappingPanelOpen, setMappingPanelOpen] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  // Generation counter for stale request handling
  const generationRef = useRef(0);
  // Debounce timer for live re-conversion (mapping changes)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce timer for markdown-change auto-update
  const mdDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if the initial mapping rules have been set (to avoid triggering re-convert on first load)
  const initialRulesLoadedRef = useRef(false);
  // Track the markdown value at last conversion to avoid re-converting on initial load
  const lastConvertedMarkdownRef = useRef<string | null>(null);

  // Font bridge
  const fontBridge = useFontBridge();

  // Persist split view layout across page reloads
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "docmd-split-view",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  const hasUnsavedChanges = markdown !== savedMarkdown;

  // --- Data loading ---
  useEffect(() => {
    docsApi.get(docId).then(setDoc).catch(console.error);
    docsApi.getContent(docId).then((content) => {
      setMarkdown(content);
      setSavedMarkdown(content);
    }).catch(console.error);
    templatesApi.list().then(setTemplates).catch(() => []);
    mappingsApi.list().then(setAllMappings).catch(() => []);
  }, [docId]);

  // --- Save handler ---
  const handleSave = useCallback(async () => {
    if (!markdown || !hasUnsavedChanges) return;
    setSaving(true);
    try {
      const updated = await docsApi.updateContent(docId, markdown);
      setDoc(updated);
      setSavedMarkdown(markdown);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [docId, markdown, hasUnsavedChanges]);

  // Keyboard shortcut: Cmd/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // --- Classification ---
  const handleClassify = useCallback(async () => {
    if (!doc || !markdown) return;
    setClassifying(true);
    try {
      const result = await agentApi.classify(
        markdown,
        doc.project_id || undefined,
        "suggest"
      );
      setClassification(result);
      if (result.recommended_template_id)
        setSelectedTemplate(result.recommended_template_id);
      if (result.recommended_mapping_id)
        setSelectedMapping(result.recommended_mapping_id);
    } catch (e) {
      console.error(e);
    } finally {
      setClassifying(false);
    }
  }, [doc, markdown]);

  useEffect(() => {
    if (doc && markdown && !classification && !classifying) {
      handleClassify();
    }
  }, [doc, markdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch template styles when template changes ---
  useEffect(() => {
    if (!selectedTemplate) return;
    templatesApi
      .getStyles(selectedTemplate)
      .then((res) => setTemplateStyles(res.styles))
      .catch(() => setTemplateStyles([]));
  }, [selectedTemplate]);

  // --- Conversion ---
  const handleConvert = async () => {
    if (!selectedTemplate || !selectedMapping) return;
    setPhase("converting");
    setConverting(true);
    try {
      const result = await convApi.convert(
        docId,
        selectedTemplate,
        selectedMapping
      );
      setConversion(result);
      const updated = await docsApi.get(docId);
      setDoc(updated);

      // Download the docx blob for preview
      if (result.status === "completed") {
        const blob = await convApi.download(result.id);
        const arrayBuf = await blob.arrayBuffer();
        setDocxPreviewData(arrayBuf);

        // Load mapping rules for inline editing
        const mapping = allMappings.find((m) => m.id === selectedMapping);
        if (mapping) {
          const flat = flattenRules(mapping.rules);
          // Auto-match empty fields to best style matches
          if (templateStyles.length > 0) {
            for (const field of MAPPING_FIELDS) {
              if (!flat[field.key]) {
                const match = bestStyleMatch(field.key, templateStyles);
                if (match) flat[field.key] = match;
              }
            }
          }
          initialRulesLoadedRef.current = false;
          setMappingRules(flat);
        }

        lastConvertedMarkdownRef.current = markdown;
        setPhase("post_convert");
      }
    } catch (e) {
      console.error(e);
      setPhase("pre_convert");
    } finally {
      setConverting(false);
    }
  };

  // --- Live re-conversion ---
  const handleReconvert = useCallback(async () => {
    if (!selectedTemplate || !selectedMapping) return;
    const gen = ++generationRef.current;
    setReconverting(true);
    try {
      const rulesOverride = unflattenRules(mappingRules) as unknown as Record<string, unknown>;
      const result = await convApi.convert(
        docId,
        selectedTemplate,
        selectedMapping,
        rulesOverride
      );
      if (gen !== generationRef.current) return; // stale
      setConversion(result);

      if (result.status === "completed") {
        const blob = await convApi.download(result.id);
        if (gen !== generationRef.current) return; // stale
        const arrayBuf = await blob.arrayBuffer();
        if (gen !== generationRef.current) return; // stale
        setDocxPreviewData(arrayBuf);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (gen === generationRef.current) {
        setReconverting(false);
      }
    }
  }, [docId, selectedTemplate, selectedMapping, mappingRules]);

  // Debounced re-convert on mapping rule change
  useEffect(() => {
    if (phase !== "post_convert") return;
    if (!initialRulesLoadedRef.current) {
      initialRulesLoadedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleReconvert();
    }, 750);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mappingRules, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced re-convert on markdown edit (longer debounce — re-conversion is expensive)
  useEffect(() => {
    if (phase !== "post_convert") return;
    if (markdown === lastConvertedMarkdownRef.current) return;
    if (mdDebounceRef.current) clearTimeout(mdDebounceRef.current);
    mdDebounceRef.current = setTimeout(() => {
      lastConvertedMarkdownRef.current = markdown;
      handleReconvert();
    }, 1500);
    return () => {
      if (mdDebounceRef.current) clearTimeout(mdDebounceRef.current);
    };
  }, [markdown, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Save Mapping ---
  const handleSaveMapping = async () => {
    if (!selectedMapping) return;
    setSavingMapping(true);
    try {
      const newRules = unflattenRules(mappingRules);
      await mappingsApi.update(selectedMapping, { rules: newRules });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMapping(false);
    }
  };

  // --- Download current preview ---
  const handleDownloadDocx = async () => {
    if (docxPreviewData) {
      // Download from in-memory preview data
      const blob = new Blob([docxPreviewData], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc?.title || "document"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (conversion) {
      // Fallback to server download
      setDownloading(true);
      try {
        const blob = await convApi.download(conversion.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc?.title || "conversion"}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed:", err);
      } finally {
        setDownloading(false);
      }
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!confirm("Delete this document?")) return;
    await docsApi.delete(docId);
    router.push("/documents");
  };

  // --- Font bridge callback for DocxPreviewPane ---
  const handleDocxRendered = useCallback(
    (container: HTMLElement) => {
      fontBridge.bridgeFonts(container);
    },
    [fontBridge]
  );

  // --- Handle template/mapping change in post-convert ---
  const handlePostConvertTemplateChange = (id: string) => {
    setSelectedTemplate(id);
    // Will trigger re-convert via toolbar button (not automatic)
  };

  const handlePostConvertMappingChange = (id: string) => {
    setSelectedMapping(id);
    // Load new mapping rules
    const mapping = allMappings.find((m) => m.id === id);
    if (mapping) {
      initialRulesLoadedRef.current = false;
      setMappingRules(flattenRules(mapping.rules));
    }
  };

  // --- Loading state ---
  if (!doc) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const modeButtons: { mode: EditorMode; icon: typeof Eye; label: string }[] = [
    { mode: "preview", icon: Eye, label: "Preview" },
    { mode: "edit", icon: Pencil, label: "Edit" },
    { mode: "split", icon: SplitSquareHorizontal, label: "Split" },
  ];

  // ============================================================
  // POST-CONVERT LAYOUT
  // ============================================================
  if (phase === "post_convert") {
    return (
      <div className="flex flex-col -m-6" style={{ height: "calc(100vh - 3.5rem)" }}>
        {/* Compact Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 shrink-0 bg-white">
          <button
            onClick={() => setPhase("pre_convert")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{doc.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-600 font-medium">Unsaved</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className="h-7"
            >
              <Save className="mr-1.5 h-3 w-3" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDocx}
              className="h-7"
            >
              <Download className="mr-1.5 h-3 w-3" />
              .docx
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} className="h-7">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Conversion Toolbar */}
        <div className="shrink-0">
          <ConversionToolbar
            templates={templates}
            mappings={allMappings}
            selectedTemplate={selectedTemplate}
            selectedMapping={selectedMapping}
            onTemplateChange={handlePostConvertTemplateChange}
            onMappingChange={handlePostConvertMappingChange}
            conversion={conversion}
            reconverting={reconverting}
            onReconvert={handleReconvert}
            onDownload={handleDownloadDocx}
            downloading={downloading}
            mappingPanelOpen={mappingPanelOpen}
            onToggleMappingPanel={() => setMappingPanelOpen(!mappingPanelOpen)}
          />
        </div>

        {/* Split View: Markdown | DOCX Preview */}
        <PanelGroup
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="flex-1 min-h-0"
        >
          {/* Left: Markdown editor */}
          <Panel id="markdown" defaultSize="50%" minSize="30%">
            <div className="flex flex-col h-full">
              {/* Editor mode tabs */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-1.5 shrink-0">
                <span className="text-xs font-medium text-slate-500">Markdown</span>
                <div className="flex rounded-md border border-slate-200 p-0.5">
                  {modeButtons.map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setEditorMode(mode)}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        editorMode === mode
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Editor content */}
              <div className="flex-1 overflow-auto">
                {markdown === null ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  </div>
                ) : editorMode === "preview" ? (
                  <div className="p-4" data-color-mode="light">
                    <MarkdownPreview
                      source={markdown}
                      style={{ backgroundColor: "transparent", fontSize: "13px" }}
                    />
                  </div>
                ) : (
                  <div data-color-mode="light" className="h-full">
                    <MDEditor
                      value={markdown}
                      onChange={(val) => setMarkdown(val || "")}
                      preview={editorMode === "split" ? "live" : "edit"}
                      height="100%"
                      visibleDragbar={false}
                      style={{ border: "none", borderRadius: 0 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-1.5 bg-slate-200 hover:bg-emerald-400 active:bg-emerald-500 transition-colors cursor-col-resize" />

          {/* Right: DOCX Preview */}
          <Panel id="preview" defaultSize="50%" minSize="30%">
            <div className="flex flex-col h-full">
              <div className="flex items-center border-b border-slate-100 bg-white px-3 py-1.5 shrink-0">
                <span className="text-xs font-medium text-slate-500">DOCX Preview</span>
              </div>
              <DocxPreviewPane
                docxData={docxPreviewData}
                reconverting={reconverting}
                fontsLoaded={fontBridge.fontsLoaded}
                fontCssRules={fontBridge.fontCssRules}
                onRendered={handleDocxRendered}
                maxHeight="none"
              />
            </div>
          </Panel>
        </PanelGroup>

        {/* Collapsible Mapping Panel */}
        <div className="shrink-0">
          <InlineMappingPanel
            rules={mappingRules}
            styles={templateStyles}
            onChange={(key, value) =>
              setMappingRules((prev) => ({ ...prev, [key]: value }))
            }
            open={mappingPanelOpen}
            onSave={handleSaveMapping}
            saving={savingMapping}
          />
        </div>
      </div>
    );
  }

  // ============================================================
  // PRE-CONVERT / CONVERTING LAYOUT (original layout)
  // ============================================================
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/documents")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{doc.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={doc.status} />
            {doc.doc_type && (
              <Badge variant="outline" className="text-xs">
                {doc.doc_type}
              </Badge>
            )}
            {doc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-slate-400">
              v{doc.current_version}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 font-medium">
              Unsaved changes
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? (
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Agent + Conversion panels */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Agent Suggestion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classifying ? (
              <div className="flex items-center gap-3 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span className="text-sm text-slate-500">Classifying document...</span>
              </div>
            ) : classification ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Detected type</span>
                  <p className="font-medium">{classification.doc_type}</p>
                </div>
                <div>
                  <span className="text-slate-500">Confidence</span>
                  <p className="font-medium">
                    {Math.round(classification.confidence * 100)}%
                  </p>
                </div>
                {classification.recommended_filename && (
                  <div>
                    <span className="text-slate-500">Suggested filename</span>
                    <p className="font-medium text-xs truncate">
                      {classification.recommended_filename}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleClassify}
                  className="mt-1 text-xs text-emerald-600 hover:underline"
                >
                  Re-classify
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClassify}
                className="w-full"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Classify Document
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Conversion Panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Convert to Word</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mapping
                </label>
                <select
                  value={selectedMapping}
                  onChange={(e) => setSelectedMapping(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select mapping...</option>
                  {allMappings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedTemplate || !selectedMapping || converting}
                onClick={handleConvert}
              >
                {converting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Convert
                  </>
                )}
              </Button>
            </div>

            {/* Converting progress */}
            {phase === "converting" && <ConvertingIndicator />}
          </CardContent>
        </Card>
      </div>

      {/* Editor / Preview */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Document Content</CardTitle>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {modeButtons.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    editorMode === mode
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {markdown === null ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : editorMode === "preview" ? (
            <div className="p-6" data-color-mode="light">
              <MarkdownPreview
                source={markdown}
                style={{
                  backgroundColor: "transparent",
                  fontSize: "14px",
                }}
              />
            </div>
          ) : (
            <div data-color-mode="light">
              <MDEditor
                value={markdown}
                onChange={(val) => setMarkdown(val || "")}
                preview={editorMode === "split" ? "live" : "edit"}
                height={600}
                visibleDragbar={false}
                style={{
                  border: "none",
                  borderRadius: 0,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Expandable warnings panel for conversion results */
function WarningsPanel({ warnings }: { warnings: string[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="flex-1 text-sm font-medium text-amber-800">
          {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-amber-200 px-4 py-3">
          <ul className="space-y-1.5">
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

/** Elapsed-time conversion indicator */
function ConvertingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { label: "Loading template", threshold: 0 },
    { label: "Parsing markdown", threshold: 2 },
    { label: "Applying styles", threshold: 4 },
    { label: "Generating document", threshold: 6 },
  ];
  const currentStep = steps.filter((s) => elapsed >= s.threshold).length - 1;

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              {steps[currentStep]?.label}...
            </p>
          </div>
        </div>
        <span className="text-xs tabular-nums text-emerald-600">
          {elapsed}s
        </span>
      </div>
      <div className="mt-3 flex gap-1">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              i <= currentStep ? "bg-emerald-500" : "bg-emerald-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
