"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Plus, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/shared/file-upload";
import { templates as templatesApi } from "@/lib/api";
import { toast } from "sonner";
import type { Template } from "@/lib/types";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[] | null>(null);
  const [stylesTemplate, setStylesTemplate] = useState("");

  useEffect(() => {
    templatesApi
      .list()
      .then(setTemplates)
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async () => {
    if (!newName || !newFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newName);
      formData.append("description", newDescription);
      formData.append("file", newFile);
      const template = await templatesApi.create(formData);
      setTemplates((prev) => [template, ...prev]);
      setDialogOpen(false);
      setNewName("");
      setNewDescription("");
      setNewFile(null);
    } catch {
      toast.error("Failed to upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleViewStyles = async (templateId: string) => {
    try {
      const result = await templatesApi.getStyles(templateId);
      setSelectedStyles(result.styles);
      setStylesTemplate(templateId);
    } catch {
      toast.error("Failed to load template styles");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await templatesApi.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#3b432f]">Templates</h1>
          <p className="text-sm text-[#6b665e]">
            Word templates that define your output document styles.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#4c573e] hover:bg-[#3b432f]">
              <Plus className="mr-2 h-4 w-4" />
              Upload Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Word Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Client-X Standard"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Description
                </label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <FileUpload
                accept=".docx"
                onFileSelect={setNewFile}
                label="Upload .docx template"
              />
              <Button
                className="w-full bg-[#4c573e] hover:bg-[#3b432f]"
                disabled={!newName || !newFile || uploading}
                onClick={handleUpload}
              >
                {uploading ? "Uploading..." : "Upload Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <LayoutTemplate className="mb-3 h-12 w-12 text-[#94908a]" />
            <h3 className="text-base font-medium text-[#44403a]">No templates yet</h3>
            <p className="mt-1 text-sm text-[#94908a]">
              Upload a .docx Word template to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/templates/${template.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <LayoutTemplate className="h-5 w-5 text-blue-600" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                    className="h-8 w-8 p-0 text-[#94908a] hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <CardTitle className="text-base">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#94908a] mb-3">
                  {template.description || "No description"}
                </p>
                <div className="flex items-center justify-between text-xs text-[#94908a]">
                  <span>v{template.version}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleViewStyles(template.id); }}
                    className="h-7 text-xs"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    View Styles
                  </Button>
                </div>

                {stylesTemplate === template.id && selectedStyles && (
                  <div className="mt-3 rounded-md bg-[#fdfcf5] p-3">
                    <p className="mb-2 text-xs font-medium text-[#6b665e]">
                      Available Styles ({selectedStyles.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedStyles.slice(0, 15).map((s) => (
                        <span
                          key={s}
                          className="rounded bg-white px-1.5 py-0.5 text-xs text-[#6b665e] border"
                        >
                          {s}
                        </span>
                      ))}
                      {selectedStyles.length > 15 && (
                        <span className="text-xs text-[#94908a]">
                          +{selectedStyles.length - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
