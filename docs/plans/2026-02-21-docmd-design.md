# DocMD — Full Product Design

**Date:** 2026-02-21
**Status:** Approved

## Overview

DocMD turns Markdown into Word documents that match an organisation's templates — reliably, repeatably, and without manual reformatting. It provides both a web UI for human workflows and an API/MCP interface for automated AI pipelines.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Web app, API-first | Both human and automated workflows are first-class |
| Backend | FastAPI (Python) | Best libraries for Word generation (python-docx) and Markdown parsing |
| Frontend | Next.js 14 (App Router) | React ecosystem, Tailwind + shadcn/ui, pure API client |
| Database | Supabase (PostgreSQL) | Postgres + Auth + File Storage + RLS in one platform |
| File storage | Supabase Storage | Templates, Markdown sources, generated .docx files |
| Auth | Supabase Auth | Email/password + Microsoft OAuth for SharePoint |
| Agent LLM | Claude or OpenAI (BYOK) | User configures their own API key, provider-agnostic |
| SharePoint | Microsoft Graph API via MSAL | Full OAuth, per-user delegated access |
| MCP Server | FastAPI + MCP Python SDK | Thin wrapper over the same service layer |
| UI inspiration | PandaDoc | Clean doc list, sidebar nav, smart views, filters |

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│  (React UI — document list, editor, template mgmt)  │
└─────────────┬───────────────────────┬───────────────┘
              │ REST/HTTP             │
              ▼                       ▼
┌─────────────────────────┐  ┌──────────────────────┐
│     FastAPI Backend      │  │    MCP Server         │
│                          │  │  (same FastAPI app,   │
│  /api/documents          │  │   MCP protocol layer) │
│  /api/templates          │  │                       │
│  /api/mappings           │  └───────────┬───────────┘
│  /api/projects           │              │
│  /api/exports            │◄─────────────┘
│  /api/agent              │
└──┬─────┬─────┬───────┬──┘
   │     │     │       │
   ▼     ▼     ▼       ▼
┌─────┐┌─────┐┌────────┐┌──────────────┐
│Supa ││Supa ││Convert ││ Microsoft    │
│base ││base ││Engine  ││ Graph API    │
│DB   ││Stor.││(python ││ (SharePoint) │
│(PG) ││     ││-docx)  ││              │
└─────┘└─────┘└────────┘└──────────────┘
```

- FastAPI serves both REST API and MCP protocol — one codebase, two interfaces
- Next.js frontend is a pure client — calls FastAPI for everything
- Supabase provides Postgres, file storage, and authentication
- The conversion engine is a Python module inside the FastAPI app
- Microsoft Graph API for SharePoint, authenticated per-user via OAuth

---

## 2. Data Model

### projects

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| description | text | |
| default_template_id | uuid | FK → templates |
| default_mapping_id | uuid | FK → mappings |
| default_destination_id | uuid | FK → destinations |
| naming_rules | jsonb | Filename/folder conventions |
| owner_id | uuid | FK → auth.users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### documents

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| title | text | |
| doc_type | text | e.g. "ADR", "Architecture", "Test Plan" |
| status | enum | received, converted, exported |
| tags | text[] | |
| metadata | jsonb | title, system, version, classification, author |
| markdown_storage_path | text | Path in Supabase Storage |
| current_version | int | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### document_versions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| document_id | uuid | FK → documents |
| version_number | int | |
| markdown_storage_path | text | Path in Supabase Storage |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |

### templates

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| description | text | |
| file_storage_path | text | .docx template in Supabase Storage |
| version | int | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |

### mappings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| version | int | |
| template_id | uuid | FK → templates |
| rules | jsonb | Markdown element → Word style mapping |
| is_default | boolean | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |

### Mapping rules schema

```json
{
  "heading": {
    "1": "Heading 1",
    "2": "Heading 2",
    "3": "Heading 3",
    "4": "Heading 4",
    "5": "Heading 5",
    "6": "Heading 6"
  },
  "paragraph": "Normal",
  "list_bullet": "List Bullet",
  "list_bullet_2": "List Bullet 2",
  "list_bullet_3": "List Bullet 3",
  "list_ordered": "List Number",
  "list_ordered_2": "List Number 2",
  "list_ordered_3": "List Number 3",
  "code_block": "Code",
  "blockquote": "Quote",
  "table": {
    "style": "Grid Table 1 Light",
    "header_row": true
  },
  "page_break_before": ["heading.1"],
  "metadata_mapping": {
    "title": "Title",
    "author": "Subtitle"
  }
}
```

### conversions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| document_id | uuid | FK → documents |
| document_version_id | uuid | FK → document_versions |
| template_id | uuid | FK → templates |
| mapping_id | uuid | FK → mappings |
| output_storage_path | text | Generated .docx in Supabase Storage |
| warnings | text[] | |
| conversion_report | jsonb | Full report with details |
| status | enum | pending, processing, completed, failed |
| started_by | uuid | FK → auth.users (or null for API) |
| started_at | timestamptz | |
| completed_at | timestamptz | |

### exports

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| conversion_id | uuid | FK → conversions |
| destination_id | uuid | FK → destinations |
| exported_path | text | Full path where file was placed |
| status | enum | pending, exporting, completed, failed |
| error_message | text | |
| exported_by | uuid | FK → auth.users |
| exported_at | timestamptz | |

### destinations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| name | text | |
| type | enum | sharepoint, local, supabase |
| config | jsonb | site_url, library_name, etc. |
| folder_rules | jsonb | Path template with variables |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |

### project_members

| Column | Type | Notes |
|--------|------|-------|
| project_id | uuid | FK → projects |
| user_id | uuid | FK → auth.users |
| role | enum | owner, editor, viewer |
| created_at | timestamptz | |

### api_keys

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| key_hash | text | Hashed API key |
| name | text | User-defined label |
| last_used_at | timestamptz | |
| created_at | timestamptz | |

### audit_log

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users (nullable for API) |
| action | text | e.g. "document.created", "conversion.started" |
| resource_type | text | e.g. "document", "template" |
| resource_id | uuid | |
| details | jsonb | Additional context |
| created_at | timestamptz | |

---

## 3. Conversion Engine

The core Python module that transforms Markdown into styled Word documents.

### Pipeline

1. **Parse Markdown to AST** — Using `mistune` to produce a tree of typed nodes (heading, paragraph, list, table, code_block, blockquote, etc.)
2. **Load Word Template** — `python-docx` opens the .docx template which contains pre-defined style definitions
3. **Apply Mapping** — Walk the AST node by node. For each node, look up the mapping rule, create the corresponding python-docx element with the mapped Word style name
4. **Validate & Report** — Check for Markdown elements with no mapping (warning), mapped styles not found in template (warning), unsupported elements (warning). Produce a conversion_report JSON.
5. **Output** — Save the generated .docx to Supabase Storage

### Element handling

| Markdown Element | Word Handling |
|-----------------|---------------|
| Headings (h1-h6) | Paragraph with mapped heading style |
| Paragraphs | Paragraph with mapped body style |
| Bold/italic/code | Character-level runs within paragraphs |
| Bullet lists | Paragraph with list bullet style, indent level for nesting |
| Ordered lists | Paragraph with list number style, indent level for nesting |
| Tables | Word table with mapped table style, optional header row |
| Code blocks | Paragraph with code style, monospace font |
| Blockquotes | Paragraph with quote/callout style |
| Horizontal rules | Optional page break or styled separator |
| Images | Inline image insertion (if URL accessible) |
| Links | Hyperlink runs within paragraphs |

### Nested list handling

Nesting levels map to progressively indented styles:
- Level 0 → `List Bullet` / `List Number`
- Level 1 → `List Bullet 2` / `List Number 2`
- Level 2 → `List Bullet 3` / `List Number 3`

---

## 4. Document Agent

LLM-powered service for document classification, template recommendation, and folder routing.

### Provider abstraction

```python
class LLMProvider(Protocol):
    async def classify(self, content: str, context: dict) -> ClassificationResult: ...

class AnthropicProvider(LLMProvider):
    # Uses Claude API via anthropic SDK
    ...

class OpenAIProvider(LLMProvider):
    # Uses OpenAI API via openai SDK
    ...
```

Users configure their preferred provider and API key in Settings. The Agent uses whichever is configured.

### Capabilities

1. **Classify** — Identify document type from content (Architecture, Requirements, ADR, Test Plan, Runbook, API Spec, etc.)
2. **Recommend** — Suggest best template, mapping, and destination folder based on doc type and project context
3. **Organize** — Propose folder structure for a project based on submitted document types
4. **Name** — Generate filenames using project naming conventions

### Modes

| Mode | Behaviour | Use Case |
|------|-----------|----------|
| `suggest` | Returns recommendations, waits for human approval | Web UI workflow |
| `auto` | Executes full pipeline immediately | API/MCP automated submissions |
| `dry-run` | Returns full execution plan as JSON, writes nothing | Integration testing |

### API

```
POST /api/agent/classify
{
  "markdown": "...",
  "project_id": "...",
  "mode": "suggest" | "auto" | "dry-run"
}

Response:
{
  "doc_type": "Architecture Decision Record",
  "confidence": 0.92,
  "recommended_template_id": "...",
  "recommended_mapping_id": "...",
  "recommended_folder": "/project-x/decisions/2026-02/",
  "recommended_filename": "ADR-007-auth-strategy.docx",
  "actions_taken": []
}
```

---

## 5. Frontend UI

### Tech stack
- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components
- PandaDoc-inspired layout

### Layout

- **Left icon nav** — Home, Documents, Templates, Mappings, Projects, Settings
- **Secondary sidebar** — Context-dependent: Smart Views, Projects list, Tags (for Documents page); template categories (for Templates page)
- **Main content area** — Document list with filter bar, or detail view, or form editors

### Pages

| Page | Purpose |
|------|---------|
| Documents | Main hub. List/filter/search all docs. Upload/paste Markdown. Status at a glance. |
| Document Detail | Markdown source, metadata, conversion history. Convert/export actions. Agent suggestions. |
| Templates | Browse/upload Word templates. Preview available styles. |
| Mappings | Visual mapping editor. Pick template, map MD elements → Word styles via dropdowns. |
| Projects | Manage projects, set defaults, configure destinations, view folder tree. |
| Settings | LLM API keys (Claude/OpenAI), Microsoft account, user preferences, permissions, API keys. |

### New Document flow

1. Click **+ Document** → modal: Upload .md, Paste Markdown, or metadata-only
2. Agent chip: "This looks like an ADR. Use template 'Client-X Standard' with mapping 'ADR Default'?"
3. User approves or overrides
4. Click **Convert** → progress → download available
5. Click **Export** → sends to destination

### Smart Views

Pre-filtered document lists:
- Needs review (status = received, no conversion)
- Recently exported (last 7 days)
- Failed conversions (status = failed)
- My documents (created_by = current user)

---

## 6. REST API

### Authentication
- Web UI: Supabase JWT (from Supabase Auth)
- API/MCP: API key in `Authorization: Bearer <key>` header

### Endpoints

```
Documents
  POST   /api/documents              Create/upload
  GET    /api/documents              List with filters
  GET    /api/documents/:id          Detail + versions
  PATCH  /api/documents/:id          Update metadata
  DELETE /api/documents/:id          Delete

Conversions
  POST   /api/documents/:id/convert  Trigger conversion
  GET    /api/conversions/:id        Result + report
  GET    /api/conversions/:id/download  Download .docx

Exports
  POST   /api/conversions/:id/export Export to destination
  GET    /api/exports/:id            Export status

Templates
  POST   /api/templates              Upload template
  GET    /api/templates              List
  GET    /api/templates/:id          Detail + style list
  PATCH  /api/templates/:id          Update
  DELETE /api/templates/:id          Delete

Mappings
  POST   /api/mappings               Create
  GET    /api/mappings               List
  GET    /api/mappings/:id           Detail
  PATCH  /api/mappings/:id           Update
  DELETE /api/mappings/:id           Delete

Projects
  POST   /api/projects               Create
  GET    /api/projects               List
  GET    /api/projects/:id           Detail
  PATCH  /api/projects/:id           Update
  DELETE /api/projects/:id           Delete

Destinations
  POST   /api/projects/:id/destinations     Create
  GET    /api/projects/:id/destinations     List
  PATCH  /api/destinations/:id              Update
  DELETE /api/destinations/:id              Delete

Agent
  POST   /api/agent/classify         Classify + recommend
  POST   /api/agent/organize         Propose folder structure

Settings
  GET    /api/settings/llm           Get LLM config
  PUT    /api/settings/llm           Set LLM provider + key
  GET    /api/settings/microsoft     Get Microsoft connection status
  PUT    /api/settings/microsoft     Store Microsoft tokens

Auth
  POST   /api/auth/microsoft         Initiate Microsoft OAuth

Audit
  GET    /api/audit-log              Query audit trail (admin)

API Keys
  POST   /api/api-keys               Generate new key
  GET    /api/api-keys               List keys
  DELETE /api/api-keys/:id           Revoke key
```

---

## 7. MCP Server

Thin wrapper over the service layer using the MCP Python SDK.

### Tools

| Tool | Maps to | Description |
|------|---------|-------------|
| `docmd_submit_document` | POST /api/documents + classify | Submit Markdown, get classification |
| `docmd_convert` | POST /api/documents/:id/convert | Convert a document |
| `docmd_export` | POST /api/conversions/:id/export | Export to destination |
| `docmd_get_status` | GET /api/documents/:id | Check document status |
| `docmd_list_templates` | GET /api/templates | List available templates |
| `docmd_list_mappings` | GET /api/mappings | List available mappings |
| `docmd_full_pipeline` | submit + classify + convert + export | End-to-end in one call |

Authentication via API key passed as MCP server config parameter.

---

## 8. SharePoint Integration

### OAuth flow

1. User clicks "Connect SharePoint" in Settings
2. Redirect to Microsoft login (`login.microsoftonline.com/oauth2/v2.0/authorize`)
3. Scopes: `Sites.ReadWrite.All`, `Files.ReadWrite.All`
4. User consents, Microsoft redirects back with auth code
5. FastAPI exchanges code for access + refresh tokens via MSAL
6. Tokens stored encrypted in Supabase DB per user

### Export flow

1. Load destination config (site_url, library_name, folder_path_template)
2. Resolve folder path using naming rules and variables (`{project_name}`, `{doc_type}`, `{year}`, `{month}`, `{author}`)
3. Check if folder exists via Graph API — if not, create recursively
4. Upload .docx via Graph API PUT
5. Record export path, timestamp, and status in DB

### Token management
- MSAL handles automatic token refresh
- Tokens encrypted at rest in Supabase
- Per-user identity — exports happen under the user's Microsoft account

---

## 9. Reporting & Governance

### Conversion reports

Every conversion produces a JSON report:
```json
{
  "document_id": "...",
  "template_used": "Client-X Standard v3",
  "mapping_used": "ADR Default v2",
  "elements_processed": 47,
  "warnings": [
    {"type": "unmapped_element", "element": "footnote", "line": 34},
    {"type": "missing_style", "style": "Code Block", "mapped_from": "code_block"}
  ],
  "stats": {
    "headings": 8,
    "paragraphs": 23,
    "lists": 6,
    "tables": 2,
    "code_blocks": 5,
    "images": 3
  }
}
```

### Audit trail

The `audit_log` table records all significant actions:
- Document created/updated/deleted
- Conversion started/completed/failed
- Export started/completed/failed
- Template/mapping created/updated
- Settings changed
- Agent invocations and decisions

### Permissions

| Role | Can do |
|------|--------|
| Owner | Everything within their projects |
| Editor | Create/convert/export docs, use templates and mappings |
| Viewer | View documents and reports, download files |
| Admin | Manage templates, mappings, destinations, and user roles |

Enforced via Supabase RLS policies on all tables.

---

## 10. Project Structure

```
docmd/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Settings, env vars
│   │   ├── dependencies.py         # Shared deps (DB, auth)
│   │   ├── routers/
│   │   │   ├── documents.py
│   │   │   ├── conversions.py
│   │   │   ├── exports.py
│   │   │   ├── templates.py
│   │   │   ├── mappings.py
│   │   │   ├── projects.py
│   │   │   ├── destinations.py
│   │   │   ├── agent.py
│   │   │   ├── settings.py
│   │   │   ├── auth.py
│   │   │   ├── audit.py
│   │   │   └── api_keys.py
│   │   ├── services/
│   │   │   ├── document_service.py
│   │   │   ├── conversion_service.py
│   │   │   ├── export_service.py
│   │   │   ├── template_service.py
│   │   │   ├── mapping_service.py
│   │   │   ├── project_service.py
│   │   │   ├── agent_service.py
│   │   │   └── sharepoint_service.py
│   │   ├── engine/
│   │   │   ├── parser.py           # Markdown → AST (mistune)
│   │   │   ├── converter.py        # AST + mapping → python-docx
│   │   │   ├── validator.py        # Check mappings, produce report
│   │   │   └── template_reader.py  # Extract styles from .docx
│   │   ├── agent/
│   │   │   ├── classifier.py       # Doc type classification
│   │   │   ├── recommender.py      # Template/mapping recommendation
│   │   │   ├── organizer.py        # Folder structure proposals
│   │   │   └── providers/
│   │   │       ├── base.py         # LLMProvider protocol
│   │   │       ├── anthropic.py    # Claude implementation
│   │   │       └── openai.py       # OpenAI implementation
│   │   ├── models/
│   │   │   ├── document.py         # Pydantic models
│   │   │   ├── template.py
│   │   │   ├── mapping.py
│   │   │   ├── project.py
│   │   │   ├── conversion.py
│   │   │   ├── export.py
│   │   │   └── agent.py
│   │   └── mcp/
│   │       └── server.py           # MCP protocol wrapper
│   ├── migrations/                  # SQL migrations
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout with sidebar
│   │   │   ├── page.tsx            # Dashboard/home
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx        # Document list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Document detail
│   │   │   ├── templates/
│   │   │   │   └── page.tsx
│   │   │   ├── mappings/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Mapping editor
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Project detail
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── icon-nav.tsx
│   │   │   │   └── top-bar.tsx
│   │   │   ├── documents/
│   │   │   │   ├── document-list.tsx
│   │   │   │   ├── document-row.tsx
│   │   │   │   ├── filter-bar.tsx
│   │   │   │   ├── new-document-modal.tsx
│   │   │   │   └── agent-suggestion.tsx
│   │   │   ├── templates/
│   │   │   ├── mappings/
│   │   │   │   └── mapping-editor.tsx
│   │   │   ├── projects/
│   │   │   └── shared/
│   │   │       ├── status-badge.tsx
│   │   │       ├── tag.tsx
│   │   │       └── file-upload.tsx
│   │   ├── lib/
│   │   │   ├── api.ts              # API client
│   │   │   ├── supabase.ts         # Supabase client
│   │   │   └── types.ts            # TypeScript types
│   │   └── hooks/
│   │       ├── use-documents.ts
│   │       ├── use-templates.ts
│   │       └── use-projects.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── docker-compose.yml
└── README.md
```
