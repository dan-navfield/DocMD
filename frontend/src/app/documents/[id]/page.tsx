"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileOutput,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
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
} from "@/lib/types";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<DocMDDocument | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allMappings, setAllMappings] = useState<Mapping[]>([]);
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [classification, setClassification] = useState<ClassifyResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedMapping, setSelectedMapping] = useState("");
  const [converting, setConverting] = useState(false);
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    docsApi.get(docId).then(setDoc).catch(console.error);
    templatesApi.list().then(setTemplates).catch(() => []);
    mappingsApi.list().then(setAllMappings).catch(() => []);
  }, [docId]);

  const handleClassify = async () => {
    if (!doc) return;
    setClassifying(true);
    try {
      const result = await agentApi.classify(
        "", // Would need to fetch markdown content
        doc.project_id || undefined,
        "suggest"
      );
      setClassification(result);
      if (result.recommended_template_id) setSelectedTemplate(result.recommended_template_id);
      if (result.recommended_mapping_id) setSelectedMapping(result.recommended_mapping_id);
    } catch (e) {
      console.error(e);
    } finally {
      setClassifying(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedTemplate || !selectedMapping) return;
    setConverting(true);
    try {
      const result = await convApi.convert(docId, selectedTemplate, selectedMapping);
      setConversion(result);
      // Refresh doc to get updated status
      const updated = await docsApi.get(docId);
      setDoc(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this document?")) return;
    await docsApi.delete(docId);
    router.push("/documents");
  };

  if (!doc) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Metadata */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Document Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Version</span>
                <p className="font-medium">v{doc.current_version}</p>
              </div>
              <div>
                <span className="text-slate-500">Created</span>
                <p className="font-medium">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              {doc.metadata &&
                Object.entries(doc.metadata).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-slate-500 capitalize">{key}</span>
                    <p className="font-medium">{value || "—"}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Agent Suggestion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classification ? (
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
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClassify}
                disabled={classifying}
                className="w-full"
              >
                {classifying ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                )}
                Classify Document
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Panel */}
      <Card>
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
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Convert
            </Button>
          </div>

          {conversion && conversion.status === "completed" && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  Conversion complete!
                </p>
                {conversion.warnings.length > 0 && (
                  <p className="mt-1 text-xs text-emerald-600">
                    {conversion.warnings.length} warning(s)
                  </p>
                )}
              </div>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/api/conversions/${conversion.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline">
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download .docx
                </Button>
              </a>
              <Button size="sm" variant="outline">
                <FileOutput className="mr-2 h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
