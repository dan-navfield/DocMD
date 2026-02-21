import { supabase } from "./supabase";
import type {
  DocMDDocument,
  Template,
  Mapping,
  Project,
  Destination,
  Conversion,
  Export,
  ClassifyResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  return res.json();
}

// Documents
export const documents = {
  list: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<DocMDDocument[]>(`/api/documents${query}`);
  },
  get: (id: string) => request<DocMDDocument>(`/api/documents/${id}`),
  create: async (data: FormData) => {
    const headers = await getAuthHeaders();
    delete (headers as Record<string, string>)["Content-Type"];
    const res = await fetch(`${API_URL}/api/documents`, {
      method: "POST",
      headers,
      body: data,
    });
    if (!res.ok) throw new Error("Failed to create document");
    return res.json() as Promise<DocMDDocument>;
  },
  update: (id: string, data: Partial<DocMDDocument>) =>
    request<DocMDDocument>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/documents/${id}`, { method: "DELETE" }),
};

// Conversions
export const conversions = {
  convert: (documentId: string, templateId: string, mappingId: string) =>
    request<Conversion>(`/api/documents/${documentId}/convert`, {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        mapping_id: mappingId,
      }),
    }),
  get: (id: string) => request<Conversion>(`/api/conversions/${id}`),
  downloadUrl: (id: string) => `${API_URL}/api/conversions/${id}/download`,
};

// Exports
export const exports_ = {
  export: (conversionId: string, destinationId: string) =>
    request<Export>(`/api/conversions/${conversionId}/export`, {
      method: "POST",
      body: JSON.stringify({ destination_id: destinationId }),
    }),
  get: (id: string) => request<Export>(`/api/exports/${id}`),
};

// Templates
export const templates = {
  list: () => request<Template[]>("/api/templates"),
  get: (id: string) => request<Template>(`/api/templates/${id}`),
  create: async (data: FormData) => {
    const headers = await getAuthHeaders();
    delete (headers as Record<string, string>)["Content-Type"];
    const res = await fetch(`${API_URL}/api/templates`, {
      method: "POST",
      headers,
      body: data,
    });
    if (!res.ok) throw new Error("Failed to create template");
    return res.json() as Promise<Template>;
  },
  getStyles: (id: string) =>
    request<{ template_id: string; styles: string[] }>(
      `/api/templates/${id}/styles`
    ),
  delete: (id: string) =>
    request(`/api/templates/${id}`, { method: "DELETE" }),
};

// Mappings
export const mappings = {
  list: (templateId?: string) => {
    const query = templateId ? `?template_id=${templateId}` : "";
    return request<Mapping[]>(`/api/mappings${query}`);
  },
  get: (id: string) => request<Mapping>(`/api/mappings/${id}`),
  create: (data: { name: string; template_id?: string; rules?: unknown }) =>
    request<Mapping>("/api/mappings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Mapping>) =>
    request<Mapping>(`/api/mappings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/mappings/${id}`, { method: "DELETE" }),
};

// Projects
export const projects = {
  list: () => request<Project[]>("/api/projects"),
  get: (id: string) => request<Project>(`/api/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/projects/${id}`, { method: "DELETE" }),
  destinations: {
    list: (projectId: string) =>
      request<Destination[]>(`/api/projects/${projectId}/destinations`),
    create: (projectId: string, data: Partial<Destination>) =>
      request<Destination>(`/api/projects/${projectId}/destinations`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

// Agent
export const agent = {
  classify: (markdown: string, projectId?: string, mode = "suggest") =>
    request<ClassifyResponse>("/api/agent/classify", {
      method: "POST",
      body: JSON.stringify({
        markdown,
        project_id: projectId,
        mode,
      }),
    }),
};

// Settings
export const settings = {
  getLLM: () =>
    request<{ provider: string; has_key: boolean }>("/api/settings/llm"),
  updateLLM: (provider: string, apiKey: string) =>
    request("/api/settings/llm", {
      method: "PUT",
      body: JSON.stringify({ provider, api_key: apiKey }),
    }),
  getMicrosoft: () =>
    request<{ connected: boolean; email: string | null }>(
      "/api/settings/microsoft"
    ),
  getApiKeys: () => request<{ id: string; name: string; key_prefix: string }[]>("/api/settings/api-keys"),
  createApiKey: (name: string) =>
    request<{ id: string; name: string; key: string }>(
      "/api/settings/api-keys",
      { method: "POST", body: JSON.stringify({ name }) }
    ),
  deleteApiKey: (id: string) =>
    request(`/api/settings/api-keys/${id}`, { method: "DELETE" }),
};
