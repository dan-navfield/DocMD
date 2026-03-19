"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { mappings as mappingsApi, templates as templatesApi } from "@/lib/api";
import { toast } from "sonner";
import type { Mapping, Template } from "@/lib/types";

export default function MappingsPage() {
  const [allMappings, setAllMappings] = useState<Mapping[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("");

  useEffect(() => {
    Promise.all([mappingsApi.list(), templatesApi.list()])
      .then(([m, t]) => {
        setAllMappings(m);
        setTemplates(t);
      })
      .catch(() => toast.error("Failed to load mappings"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    try {
      const mapping = await mappingsApi.create({
        name: newName,
        template_id: newTemplateId || undefined,
      });
      setAllMappings((prev) => [mapping, ...prev]);
      setDialogOpen(false);
      setNewName("");
      setNewTemplateId("");
    } catch {
      toast.error("Failed to create mapping");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    try {
      await mappingsApi.delete(id);
      setAllMappings((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error("Failed to delete mapping");
    }
  };

  const getTemplateName = (id: string | null) => {
    if (!id) return null;
    return templates.find((t) => t.id === id)?.name || "Unknown";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#3b432f]">Mappings</h1>
          <p className="text-sm text-[#6b665e]">
            Define how Markdown elements map to Word styles.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#4c573e] hover:bg-[#3b432f]">
              <Plus className="mr-2 h-4 w-4" />
              New Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. ADR Default Mapping"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Template (optional)</label>
                <select
                  value={newTemplateId}
                  onChange={(e) => setNewTemplateId(e.target.value)}
                  className="w-full rounded-md border border-[#dddacc] px-3 py-2 text-sm"
                >
                  <option value="">No specific template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full bg-[#4c573e] hover:bg-[#3b432f]"
                disabled={!newName}
                onClick={handleCreate}
              >
                Create Mapping
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
        </div>
      ) : allMappings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <GitBranch className="mb-3 h-12 w-12 text-[#94908a]" />
            <h3 className="text-base font-medium text-[#44403a]">No mappings yet</h3>
            <p className="mt-1 text-sm text-[#94908a]">
              Create a mapping to define how Markdown converts to Word.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allMappings.map((mapping) => (
            <Card key={mapping.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <GitBranch className="h-5 w-5 text-purple-600" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(mapping.id)}
                    className="h-8 w-8 p-0 text-[#94908a] hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <CardTitle className="text-base">{mapping.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  {mapping.is_default && (
                    <Badge className="bg-[#fafd99]/20 text-[#3b432f] text-xs">
                      Default
                    </Badge>
                  )}
                  {mapping.template_id && (
                    <Badge variant="outline" className="text-xs">
                      {getTemplateName(mapping.template_id)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-[#94908a]">
                  <span>v{mapping.version}</span>
                  <Link
                    href={`/mappings/${mapping.id}`}
                    className="text-[#4c573e] hover:text-[#3b432f]"
                  >
                    Edit rules
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
