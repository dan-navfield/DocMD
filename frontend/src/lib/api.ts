import { supabase } from "./supabase";
import type {
  MDDocDocument,
  Template,
  Mapping,
  Project,
  Destination,
  Conversion,
  Export,
  ClassifyResponse,
  Font,
  Subscription,
  SubscriptionUsage,
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
    return request<MDDocDocument[]>(`/api/documents${query}`);
  },
  get: (id: string) => request<MDDocDocument>(`/api/documents/${id}`),
  getContent: async (id: string): Promise<string> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/documents/${id}/content`, { headers });
    if (!res.ok) throw new Error("Failed to fetch content");
    return res.text();
  },
  updateContent: async (id: string, markdown: string): Promise<MDDocDocument> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/documents/${id}/content`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "text/markdown" },
      body: markdown,
    });
    if (!res.ok) throw new Error("Failed to save content");
    return res.json();
  },
  create: async (data: FormData) => {
    const headers = await getAuthHeaders();
    delete (headers as Record<string, string>)["Content-Type"];
    const res = await fetch(`${API_URL}/api/documents`, {
      method: "POST",
      headers,
      body: data,
    });
    if (!res.ok) throw new Error("Failed to create document");
    return res.json() as Promise<MDDocDocument>;
  },
  update: (id: string, data: Partial<MDDocDocument>) =>
    request<MDDocDocument>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/documents/${id}`, { method: "DELETE" }),
};

// Conversions
export const conversions = {
  convert: (documentId: string, templateId: string, mappingId: string, mappingRulesOverride?: Record<string, unknown>) =>
    request<Conversion>(`/api/documents/${documentId}/convert`, {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        mapping_id: mappingId,
        ...(mappingRulesOverride ? { mapping_rules_override: mappingRulesOverride } : {}),
      }),
    }),
  get: (id: string) => request<Conversion>(`/api/conversions/${id}`),
  downloadUrl: (id: string) => `${API_URL}/api/conversions/${id}/download`,
  download: async (id: string): Promise<Blob> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const res = await fetch(`${API_URL}/api/conversions/${id}/download`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Download failed");
    }
    return res.blob();
  },
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
    request<{ template_id: string; styles: string[]; used_styles: string[] }>(
      `/api/templates/${id}/styles`
    ),
  getStyleMap: (id: string) =>
    request<{ template_id: string; paragraphs: { index: number; text: string; style: string }[] }>(
      `/api/templates/${id}/style-map`
    ),
  download: async (id: string): Promise<ArrayBuffer> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/templates/${id}/download`, { headers });
    if (!res.ok) throw new Error("Failed to download template");
    return res.arrayBuffer();
  },
  preview: async (id: string): Promise<string> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/templates/${id}/preview`, { headers });
    if (!res.ok) throw new Error("Failed to generate preview");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  delete: (id: string) =>
    request(`/api/templates/${id}`, { method: "DELETE" }),
  getOnlyofficeConfig: (id: string) =>
    request<{
      config: Record<string, unknown>;
      onlyoffice_url: string;
    }>(`/api/templates/${id}/onlyoffice-config`),
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

// Fonts
export const fonts = {
  list: () => request<Font[]>("/api/fonts"),
  upload: async (files: File[]): Promise<{ fonts: Font[]; onlyoffice_refreshed: boolean }> => {
    const headers = await getAuthHeaders();
    delete (headers as Record<string, string>)["Content-Type"];
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_URL}/api/fonts`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Upload failed");
    }
    return res.json();
  },
  delete: (id: string) =>
    request(`/api/fonts/${id}`, { method: "DELETE" }),
  fetchFile: async (id: string): Promise<Blob> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/fonts/${id}/file`, { headers });
    if (!res.ok) throw new Error("Failed to fetch font file");
    return res.blob();
  },
};

// Onboarding
export const onboarding = {
  getStatus: () =>
    request<{ completed: boolean; completed_at: string | null }>(
      "/api/onboarding/status"
    ),
  markComplete: () =>
    request<{ completed: boolean; completed_at: string | null }>(
      "/api/onboarding/complete",
      { method: "POST" }
    ),
  seedMapping: (data: { template_id?: string; name?: string }) =>
    request<{ mapping_id: string; mapping: Record<string, unknown> }>(
      "/api/onboarding/seed-mapping",
      { method: "POST", body: JSON.stringify(data) }
    ),
};

// Billing
export const billing = {
  getSubscription: () =>
    request<Subscription>("/api/billing/subscription"),
  getUsage: () =>
    request<SubscriptionUsage>("/api/billing/usage"),
  createCheckoutSession: (
    tier: string,
    interval: string = "month",
    successUrl?: string,
    cancelUrl?: string
  ) =>
    request<{ checkout_url: string }>("/api/billing/checkout-session", {
      method: "POST",
      body: JSON.stringify({
        tier,
        interval,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    }),
  createPortalSession: (returnUrl?: string) =>
    request<{ portal_url: string }>("/api/billing/portal-session", {
      method: "POST",
      body: JSON.stringify({ return_url: returnUrl }),
    }),
};
