export type DocumentStatus = "received" | "converted" | "exported";
export type ConversionStatus = "pending" | "processing" | "completed" | "failed";
export type ExportStatus = "pending" | "exporting" | "completed" | "failed";
export type DestinationType = "sharepoint" | "local" | "supabase";
export type ProjectRole = "owner" | "editor" | "viewer";
export type LLMProvider = "anthropic" | "openai";

export interface DocMDDocument {
  id: string;
  project_id: string | null;
  title: string;
  doc_type: string;
  status: DocumentStatus;
  tags: string[];
  metadata: Record<string, string>;
  markdown_storage_path: string;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  markdown_storage_path: string;
  created_by: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  file_storage_path: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MappingRules {
  heading: Record<string, string>;
  document_title: string;
  document_subtitle: string;
  paragraph: string;
  list_bullet: string;
  list_bullet_2: string;
  list_bullet_3: string;
  list_ordered: string;
  list_ordered_2: string;
  list_ordered_3: string;
  code_block: string;
  blockquote: string;
  table: { style: string; header_row: boolean };
  page_break_before: string[];
  metadata_mapping: Record<string, string>;
}

export interface Mapping {
  id: string;
  name: string;
  version: number;
  template_id: string | null;
  rules: MappingRules;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  default_template_id: string | null;
  default_mapping_id: string | null;
  default_destination_id: string | null;
  naming_rules: Record<string, string>;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Destination {
  id: string;
  project_id: string;
  name: string;
  type: DestinationType;
  config: Record<string, string>;
  folder_rules: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Conversion {
  id: string;
  document_id: string;
  document_version_id: string | null;
  template_id: string;
  mapping_id: string;
  output_storage_path: string | null;
  warnings: string[];
  conversion_report: Record<string, unknown>;
  status: ConversionStatus;
  started_by: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Export {
  id: string;
  conversion_id: string;
  destination_id: string;
  exported_path: string | null;
  status: ExportStatus;
  error_message: string | null;
  exported_by: string | null;
  exported_at: string;
}

export interface Font {
  id: string;
  name: string;
  family: string;
  font_aliases: string[];
  filename: string;
  file_storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  created_by: string;
  created_at: string;
}

export type SubscriptionTier = "solo" | "team" | "enterprise";
export type SubscriptionStatusType =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatusType;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  price_id: string | null;
  billing_interval: string | null;
  conversions_this_period: number;
  period_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsage {
  tier: SubscriptionTier;
  status: SubscriptionStatusType;
  conversions_used: number;
  conversions_limit: number | null;
  templates_used: number;
  templates_limit: number | null;
  features: Record<string, boolean>;
}

export interface ClassifyResponse {
  doc_type: string;
  confidence: number;
  recommended_template_id: string | null;
  recommended_mapping_id: string | null;
  recommended_folder: string | null;
  recommended_filename: string | null;
  actions_taken: Record<string, unknown>[];
}
