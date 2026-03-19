"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
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
import { projects as projectsApi } from "@/lib/api";
import { toast } from "sonner";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjectList)
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    try {
      const project = await projectsApi.create({
        name: newName,
        description: newDesc,
      });
      setProjectList((prev) => [project, ...prev]);
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
    } catch {
      toast.error("Failed to create project");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    try {
      await projectsApi.delete(id);
      setProjectList((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#3b432f]">Projects</h1>
          <p className="text-sm text-[#6b665e]">
            Organise documents and standardise output settings.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#4c573e] hover:bg-[#3b432f]">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Client X Migration"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <Button
                className="w-full bg-[#4c573e] hover:bg-[#3b432f]"
                disabled={!newName}
                onClick={handleCreate}
              >
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
        </div>
      ) : projectList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FolderKanban className="mb-3 h-12 w-12 text-[#94908a]" />
            <h3 className="text-base font-medium text-[#44403a]">No projects yet</h3>
            <p className="mt-1 text-sm text-[#94908a]">
              Create a project to organise your documents.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <FolderKanban className="h-5 w-5 text-amber-600" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                    className="h-8 w-8 p-0 text-[#94908a] hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <CardTitle className="text-base">{project.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#94908a] mb-3">
                  {project.description || "No description"}
                </p>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-[#4c573e] hover:text-[#3b432f]"
                >
                  View project
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
