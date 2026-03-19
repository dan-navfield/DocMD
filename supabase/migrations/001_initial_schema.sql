-- MDDoc Initial Schema
-- All tables, enums, RLS policies, indexes, and storage buckets

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE document_status AS ENUM ('received', 'converted', 'exported');
CREATE TYPE conversion_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE export_status AS ENUM ('pending', 'exporting', 'completed', 'failed');
CREATE TYPE destination_type AS ENUM ('sharepoint', 'local', 'supabase');
CREATE TYPE project_role AS ENUM ('owner', 'editor', 'viewer');

-- ============================================================
-- TABLES
-- ============================================================

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    default_template_id UUID,
    default_mapping_id UUID,
    default_destination_id UUID,
    naming_rules JSONB DEFAULT '{}',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project members
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role project_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- Templates (Word .docx templates)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    file_storage_path TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mappings (Markdown → Word style rules)
CREATE TABLE mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    rules JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    doc_type TEXT DEFAULT '',
    status document_status NOT NULL DEFAULT 'received',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    markdown_storage_path TEXT NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    markdown_storage_path TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

-- Conversions
CREATE TABLE conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    mapping_id UUID NOT NULL REFERENCES mappings(id) ON DELETE RESTRICT,
    output_storage_path TEXT,
    warnings TEXT[] DEFAULT '{}',
    conversion_report JSONB DEFAULT '{}',
    status conversion_status NOT NULL DEFAULT 'pending',
    started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Destinations (SharePoint, local, etc.)
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type destination_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    folder_rules JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exports
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversion_id UUID NOT NULL REFERENCES conversions(id) ON DELETE CASCADE,
    destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
    exported_path TEXT,
    status export_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User settings (LLM keys, preferences)
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    llm_provider TEXT DEFAULT 'anthropic',
    llm_api_key_encrypted TEXT,
    microsoft_tokens_encrypted JSONB,
    preferences JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FOREIGN KEY CONSTRAINTS (deferred for circular refs)
-- ============================================================

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_default_template
    FOREIGN KEY (default_template_id) REFERENCES templates(id) ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_default_mapping
    FOREIGN KEY (default_mapping_id) REFERENCES mappings(id) ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_default_destination
    FOREIGN KEY (default_destination_id) REFERENCES destinations(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_doc_type ON documents(doc_type);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

CREATE INDEX idx_document_versions_document ON document_versions(document_id);

CREATE INDEX idx_conversions_document ON conversions(document_id);
CREATE INDEX idx_conversions_status ON conversions(status);

CREATE INDEX idx_exports_conversion ON exports(conversion_id);
CREATE INDEX idx_exports_status ON exports(status);

CREATE INDEX idx_destinations_project ON destinations(project_id);

CREATE INDEX idx_project_members_user ON project_members(user_id);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is a member of a project
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id AND user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM projects
        WHERE id = p_project_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user has a specific role or higher in a project
CREATE OR REPLACE FUNCTION has_project_role(p_project_id UUID, p_user_id UUID, p_min_role project_role)
RETURNS BOOLEAN AS $$
BEGIN
    -- Owner of the project always has access
    IF EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND owner_id = p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF p_min_role = 'viewer' THEN
        RETURN EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = p_project_id AND user_id = p_user_id
        );
    ELSIF p_min_role = 'editor' THEN
        RETURN EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = p_project_id AND user_id = p_user_id AND role IN ('editor', 'owner')
        );
    ELSIF p_min_role = 'owner' THEN
        RETURN EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'owner'
        );
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects: owner or member can see
CREATE POLICY projects_select ON projects FOR SELECT
    USING (owner_id = auth.uid() OR is_project_member(id, auth.uid()));

CREATE POLICY projects_insert ON projects FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update ON projects FOR UPDATE
    USING (owner_id = auth.uid() OR has_project_role(id, auth.uid(), 'owner'));

CREATE POLICY projects_delete ON projects FOR DELETE
    USING (owner_id = auth.uid());

-- Project members: project owner or fellow members can see
CREATE POLICY project_members_select ON project_members FOR SELECT
    USING (is_project_member(project_id, auth.uid()));

CREATE POLICY project_members_insert ON project_members FOR INSERT
    WITH CHECK (has_project_role(project_id, auth.uid(), 'owner'));

CREATE POLICY project_members_delete ON project_members FOR DELETE
    USING (has_project_role(project_id, auth.uid(), 'owner'));

-- Templates: anyone authenticated can read, creator can modify
CREATE POLICY templates_select ON templates FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY templates_insert ON templates FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY templates_update ON templates FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY templates_delete ON templates FOR DELETE
    USING (created_by = auth.uid());

-- Mappings: anyone authenticated can read, creator can modify
CREATE POLICY mappings_select ON mappings FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY mappings_insert ON mappings FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY mappings_update ON mappings FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY mappings_delete ON mappings FOR DELETE
    USING (created_by = auth.uid());

-- Documents: creator or project member can access
CREATE POLICY documents_select ON documents FOR SELECT
    USING (
        created_by = auth.uid()
        OR (project_id IS NOT NULL AND is_project_member(project_id, auth.uid()))
    );

CREATE POLICY documents_insert ON documents FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY documents_update ON documents FOR UPDATE
    USING (
        created_by = auth.uid()
        OR (project_id IS NOT NULL AND has_project_role(project_id, auth.uid(), 'editor'))
    );

CREATE POLICY documents_delete ON documents FOR DELETE
    USING (created_by = auth.uid());

-- Document versions: same access as parent document
CREATE POLICY document_versions_select ON document_versions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_versions.document_id
        AND (d.created_by = auth.uid() OR (d.project_id IS NOT NULL AND is_project_member(d.project_id, auth.uid())))
    ));

CREATE POLICY document_versions_insert ON document_versions FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Conversions: same access as parent document
CREATE POLICY conversions_select ON conversions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = conversions.document_id
        AND (d.created_by = auth.uid() OR (d.project_id IS NOT NULL AND is_project_member(d.project_id, auth.uid())))
    ));

CREATE POLICY conversions_insert ON conversions FOR INSERT
    WITH CHECK (started_by = auth.uid());

-- Destinations: project members can see, editors can modify
CREATE POLICY destinations_select ON destinations FOR SELECT
    USING (is_project_member(project_id, auth.uid()));

CREATE POLICY destinations_insert ON destinations FOR INSERT
    WITH CHECK (has_project_role(project_id, auth.uid(), 'editor'));

CREATE POLICY destinations_update ON destinations FOR UPDATE
    USING (has_project_role(project_id, auth.uid(), 'editor'));

CREATE POLICY destinations_delete ON destinations FOR DELETE
    USING (has_project_role(project_id, auth.uid(), 'owner'));

-- Exports: same access as parent conversion's document
CREATE POLICY exports_select ON exports FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM conversions c
        JOIN documents d ON d.id = c.document_id
        WHERE c.id = exports.conversion_id
        AND (d.created_by = auth.uid() OR (d.project_id IS NOT NULL AND is_project_member(d.project_id, auth.uid())))
    ));

CREATE POLICY exports_insert ON exports FOR INSERT
    WITH CHECK (exported_by = auth.uid());

-- API keys: users can only see their own
CREATE POLICY api_keys_select ON api_keys FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY api_keys_insert ON api_keys FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY api_keys_delete ON api_keys FOR DELETE
    USING (user_id = auth.uid());

-- User settings: users can only see their own
CREATE POLICY user_settings_select ON user_settings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY user_settings_insert ON user_settings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_update ON user_settings FOR UPDATE
    USING (user_id = auth.uid());

-- Audit log: users can see entries related to them
CREATE POLICY audit_log_select ON audit_log FOR SELECT
    USING (user_id = auth.uid());

-- Service role can insert audit log entries (bypasses RLS)
-- The backend uses the service key for audit log writes

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- These need to be created via Supabase Storage API:
--   - markdown-sources (private)
--   - templates (private)
--   - generated-docs (private)
