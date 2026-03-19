"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FolderPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  projects as projectsApi,
  templates as templatesApi,
  mappings as mappingsApi,
} from "@/lib/api";
import { toast } from "sonner";
import type { Project, Template, Mapping, Destination } from "@/lib/types";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allMappings, setAllMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    projectsApi.get(projectId).then(setProject).catch(() => toast.error("Failed to load project"));
    projectsApi.destinations.list(projectId).then(setDestinations).catch(() => toast.error("Failed to load destinations"));
    templatesApi.list().then(setTemplates).catch(() => toast.error("Failed to load templates"));
    mappingsApi.list().then(setAllMappings).catch(() => toast.error("Failed to load mappings"));
  }, [projectId]);

  if (!project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/projects")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94908a] hover:bg-[#edebe0]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#3b432f]">{project.name}</h1>
          <p className="text-sm text-[#94908a]">{project.description}</p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="destinations">Destinations</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default Template</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={project.default_template_id || ""}
                onChange={async (e) => {
                  const updated = await projectsApi.update(projectId, {
                    default_template_id: e.target.value || null,
                  });
                  setProject(updated);
                }}
                className="w-full rounded-md border border-[#dddacc] px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={project.default_mapping_id || ""}
                onChange={async (e) => {
                  const updated = await projectsApi.update(projectId, {
                    default_mapping_id: e.target.value || null,
                  });
                  setProject(updated);
                }}
                className="w-full rounded-md border border-[#dddacc] px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {allMappings.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="destinations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Export Destinations</CardTitle>
              <Button variant="outline" size="sm">
                <FolderPlus className="mr-2 h-3.5 w-3.5" />
                Add Destination
              </Button>
            </CardHeader>
            <CardContent>
              {destinations.length === 0 ? (
                <p className="text-sm text-[#94908a]">
                  No destinations configured. Add a SharePoint connection or
                  other export target.
                </p>
              ) : (
                <div className="space-y-2">
                  {destinations.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-[#94908a]">{d.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Team Members</CardTitle>
              <Button variant="outline" size="sm">
                <Users className="mr-2 h-3.5 w-3.5" />
                Invite Member
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#94908a]">
                Member management coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
