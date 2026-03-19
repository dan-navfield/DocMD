# MDDoc Architecture

> Markdown in. Word out. Perfectly styled.

MDDoc converts Markdown documents into professionally formatted Word documents using organisational templates, with AI-powered classification and SharePoint export.

---

## System Overview

```
                         ┌──────────────────────────┐
                         │      Next.js Frontend     │
                         │     (React / TypeScript)  │
                         │        Port 3000          │
                         └────────────┬─────────────┘
                                      │  REST API
                                      ▼
                         ┌──────────────────────────┐
                         │     FastAPI Backend       │
                         │       (Python)            │
                         │        Port 8000          │
                         └──┬─────┬──────┬──────┬───┘
                            │     │      │      │
                    ┌───────┘     │      │      └────────┐
                    ▼             ▼      ▼               ▼
              ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
              │ Supabase │ │   LLM   │ │  Microsoft│ │   MCP    │
              │ (PG/Auth │ │ Providers│ │  Graph   │ │  Server  │
              │ /Storage)│ │(Claude/ │ │(SharePoint│ │ (7 tools)│
              └──────────┘ │ OpenAI) │ │  Export) │ └──────────┘
                           └─────────┘ └──────────┘
```

---

## Tech Stack

| Layer        | Technology                            |
|------------- |---------------------------------------|
| Frontend     | Next.js 16, React 19, TypeScript 5    |
| UI           | Tailwind CSS 4, shadcn/ui (Radix)     |
| Backend      | FastAPI 0.115, Python 3.12, Uvicorn   |
| Database     | PostgreSQL 15.6 (via Supabase)        |
| Auth         | Supabase Auth (email + Microsoft OAuth) |
| Storage      | Supabase Storage (3 buckets)          |
| Doc Engine   | python-docx, mistune (Markdown parser)|
| AI Agent     | Anthropic Claude / OpenAI GPT (BYOK)  |
| SharePoint   | Microsoft Graph API via MSAL          |
| MCP          | Python MCP SDK (stdio transport)      |
| Containers   | Docker Compose                        |

---

## Directory Structure

```
HS-Website-2026/
├── backend/
│   ├── app/
│   │   ├── routers/          # 10 API routers (48 endpoints)
│   │   ├── services/         # 10 business logic services
│   │   ├── models/           # Pydantic request/response models
│   │   ├── engine/           # Markdown → Word conversion engine
│   │   │   ├── parser.py     # Markdown → AST (mistune)
│   │   │   ├── converter.py  # AST → styled .docx (python-docx)
│   │   │   ├── template_reader.py  # Extract styles from .docx
│   │   │   └── validator.py  # Validate mappings against templates
│   │   ├── agent/            # AI document classification
│   │   │   ├── providers/    # LLM provider abstraction
│   │   │   │   ├── base.py   # Protocol + prompts
│   │   │   │   ├── anthropic.py
│   │   │   │   └── openai.py
│   │   │   └── classifier.py # Doc type classification
│   │   ├── mcp/              # MCP server (7 tools)
│   │   ├── lib/              # Patched Supabase client
│   │   ├── config.py         # Pydantic settings
│   │   ├── dependencies.py   # FastAPI DI (auth, DB clients)
│   │   └── main.py           # App entrypoint + CORS
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── login/page.tsx        # Auth (split-screen)
│   │   │   ├── documents/            # Document CRUD + detail
│   │   │   ├── templates/page.tsx    # Template library
│   │   │   ├── mappings/             # Mapping list + editor
│   │   │   ├── projects/             # Project list + detail
│   │   │   └── settings/page.tsx     # Profile, config, API keys
│   │   ├── components/
│   │   │   ├── ui/           # shadcn/ui primitives
│   │   │   ├── layout/       # Icon nav, sidebar, top bar
│   │   │   ├── shared/       # File upload, status badge
│   │   │   ├── app-shell.tsx # Layout wrapper (skips on /login)
│   │   │   └── auth-provider.tsx  # Auth guard + redirect
│   │   └── lib/
│   │       ├── api.ts        # API client (all endpoints)
│   │       ├── supabase.ts   # Supabase client init
│   │       ├── types.ts      # TypeScript type definitions
│   │       └── utils.ts      # cn() helper
│   ├── package.json
│   ├── Dockerfile
│   └── .env.local
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Full schema (12 tables)
│
├── docs/
│   ├── ARCHITECTURE.md               # This file
│   └── plans/
│       ├── 2026-02-21-docmd-design.md
│       └── 2026-02-21-docmd-implementation-plan.md
│
└── docker-compose.yml
```

---

## Database Schema

### Tables (12)

| Table              | Purpose                                    |
|--------------------|--------------------------------------------|
| `projects`         | Workspace containers for documents         |
| `project_members`  | Team members with role-based access        |
| `documents`        | Markdown source documents                  |
| `document_versions`| Version history for each document          |
| `templates`        | Word .docx template files                  |
| `mappings`         | Markdown → Word style mapping rules        |
| `conversions`      | Conversion job records + output files      |
| `destinations`     | Export targets (SharePoint, local, Supabase)|
| `exports`          | Export job records                          |
| `api_keys`         | Hashed API keys for programmatic access    |
| `user_settings`    | LLM provider config, Microsoft tokens      |
| `audit_log`        | Compliance audit trail                     |

### Enums

- `document_status`: received → converted → exported
- `conversion_status`: pending → processing → completed / failed
- `export_status`: pending → exporting → completed / failed
- `destination_type`: sharepoint, local, supabase
- `project_role`: owner, editor, viewer

### Security

- **Row-Level Security (RLS)** enabled on all 12 tables
- Helper functions: `is_project_member()`, `has_project_role()`
- 36 RLS policies enforce access control at the database level
- `update_updated_at` trigger on 6 tables

### Storage Buckets

| Bucket             | Contents                    |
|--------------------|-----------------------------|
| `markdown-sources` | Original .md files (private)|
| `templates`        | Word .docx templates        |
| `generated-docs`   | Converted output .docx files|

---

## API Routes

### Auth (`/api/auth`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/auth/microsoft`           | Start Microsoft OAuth     |
| GET    | `/auth/microsoft/callback`  | OAuth callback handler    |

### Documents (`/api/documents`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/documents`                | Create (file upload)      |
| GET    | `/documents`                | List with filters         |
| GET    | `/documents/{id}`           | Get details               |
| PATCH  | `/documents/{id}`           | Update metadata           |
| DELETE | `/documents/{id}`           | Delete                    |
| GET    | `/documents/{id}/versions`  | Version history           |

### Conversions (`/api`)
| Method | Path                             | Description            |
|--------|----------------------------------|------------------------|
| POST   | `/documents/{id}/convert`        | Start conversion       |
| GET    | `/conversions/{id}`              | Get status             |
| GET    | `/conversions/{id}/download`     | Download .docx         |

### Exports (`/api`)
| Method | Path                             | Description            |
|--------|----------------------------------|------------------------|
| POST   | `/conversions/{id}/export`       | Export to destination   |
| GET    | `/exports/{id}`                  | Get export status      |

### Templates (`/api/templates`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/templates`                | Upload template           |
| GET    | `/templates`                | List all                  |
| GET    | `/templates/{id}`           | Get details               |
| PATCH  | `/templates/{id}`           | Update                    |
| DELETE | `/templates/{id}`           | Delete                    |
| GET    | `/templates/{id}/styles`    | Extract Word styles       |

### Mappings (`/api/mappings`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/mappings`                 | Create mapping            |
| GET    | `/mappings`                 | List (filter by template) |
| GET    | `/mappings/{id}`            | Get details               |
| PATCH  | `/mappings/{id}`            | Update rules              |
| DELETE | `/mappings/{id}`            | Delete                    |

### Projects (`/api/projects`)
| Method | Path                                  | Description          |
|--------|---------------------------------------|----------------------|
| POST   | `/projects`                           | Create project       |
| GET    | `/projects`                           | List projects        |
| GET    | `/projects/{id}`                      | Get details          |
| PATCH  | `/projects/{id}`                      | Update               |
| DELETE | `/projects/{id}`                      | Delete               |
| GET    | `/projects/{id}/destinations`         | List destinations    |
| POST   | `/projects/{id}/destinations`         | Add destination      |
| GET    | `/projects/{id}/members`              | List members         |
| POST   | `/projects/{id}/members`              | Add member           |
| DELETE | `/projects/{id}/members/{user_id}`    | Remove member        |

### Settings (`/api/settings`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/settings/llm`             | Get LLM config            |
| PUT    | `/settings/llm`             | Update provider + API key |
| GET    | `/settings/microsoft`       | Connection status          |
| GET    | `/settings/api-keys`        | List API keys             |
| POST   | `/settings/api-keys`        | Generate new key          |
| DELETE | `/settings/api-keys/{id}`   | Revoke key                |

### Agent (`/api/agent`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/agent/classify`           | Classify document         |
| POST   | `/agent/organize`           | Suggest organisation      |

### Audit (`/api/audit`)
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/audit`                    | Query audit log           |

### Health
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | `/health`                   | Service health check      |

---

## Conversion Pipeline

```
 ┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌───────────┐
 │  Markdown   │────▶│  Parser  │────▶│ Validator  │────▶│ Converter │
 │  (source)   │     │ (mistune)│     │(check map) │     │(python-   │
 └─────────────┘     └──────────┘     └───────────┘     │  docx)    │
                          │                                └─────┬─────┘
                     AST nodes:                                  │
                     - headings                            ┌─────▼─────┐
                     - paragraphs                          │  .docx +  │
                     - lists (nested)                      │  Report   │
                     - tables           ┌──────────┐       └───────────┘
                     - code blocks      │ Template │
                     - blockquotes      │ Reader   │──── styles list
                     - inline format    └──────────┘
```

1. **Parser** (`engine/parser.py`): Markdown → AST using mistune. Normalises headings, paragraphs, lists, tables, code blocks, blockquotes, inline elements.
2. **Template Reader** (`engine/template_reader.py`): Extracts paragraph and character styles from the target .docx template.
3. **Validator** (`engine/validator.py`): Checks mapping rules reference real styles and flags unmapped elements.
4. **Converter** (`engine/converter.py`): Walks AST, applies mapping rules, handles nested lists, inline formatting, tables, code blocks, page breaks. Returns `(docx_bytes, conversion_report)`.

---

## AI Agent

The agent classifies documents and suggests templates/mappings using configurable LLM providers.

### Provider Abstraction

```python
class LLMProvider(Protocol):
    async def classify(self, markdown: str, doc_types: list[str]) -> dict: ...
```

- **AnthropicProvider**: Claude Sonnet via Anthropic SDK
- **OpenAIProvider**: GPT-4o via OpenAI SDK (json_object response format)

### Classification

14 built-in document types: ADR, API Spec, Runbook, Design Doc, Meeting Notes, RFC, SOP, Technical Spec, User Guide, Release Notes, Incident Report, Onboarding, README, Generic.

### Modes

- **suggest**: Returns classification + confidence, user decides
- **auto**: Classifies and triggers conversion automatically
- **dry-run**: Full pipeline simulation without writing output

---

## MCP Server

Exposes MDDoc as 7 MCP tools for AI assistant integration:

| Tool                      | Description                                      |
|---------------------------|--------------------------------------------------|
| `mddoc_submit_document`   | Submit markdown + auto-classify                  |
| `mddoc_convert`           | Convert with template + mapping                  |
| `mddoc_export`            | Export to SharePoint / storage                   |
| `mddoc_get_status`        | Check document status                            |
| `mddoc_list_templates`    | List available templates                         |
| `mddoc_list_mappings`     | List available mappings                          |
| `mddoc_full_pipeline`     | End-to-end: submit → classify → convert → export |

Auth: Each tool call includes a MDDoc API key, resolved to `user_id` via hashed lookup.

Transport: stdio (launched as subprocess by Claude Desktop or Claude Code).

---

## Authentication Flow

```
Browser                    Frontend              Backend              Supabase
  │                           │                     │                     │
  │── login (email/pw) ──────▶│                     │                     │
  │                           │── signInWithPassword ────────────────────▶│
  │                           │◀──────── session (JWT) ──────────────────│
  │                           │                     │                     │
  │── API request ───────────▶│                     │                     │
  │                           │── Bearer {JWT} ────▶│                     │
  │                           │                     │── getUser(JWT) ────▶│
  │                           │                     │◀──── user data ─────│
  │                           │◀──── response ──────│                     │
```

- **Web UI**: Supabase Auth JWT in Authorization header
- **API / MCP**: MDDoc API key → hashed lookup in `api_keys` table → `user_id`
- **Auth Guard**: `AuthProvider` component redirects to `/login` if no session
- **App Shell**: Conditionally renders nav/sidebar (skipped on `/login`)

---

## Frontend Layout

```
┌─────────────────────────────────────────────────────────┐
│ ┌─────┐ ┌─────────────────────────────────────────────┐ │
│ │Icon │ │  Top Bar (tabs: Docs | Templates | ...)  ⚙  │ │
│ │ Nav │ ├─────────────┬───────────────────────────────┤ │
│ │     │ │  Sidebar    │                               │ │
│ │ 🏠  │ │             │                               │ │
│ │ 📄  │ │ + New Doc   │     Main Content Area         │ │
│ │ 📋  │ │             │                               │ │
│ │ 🔗  │ │ Smart Views │                               │ │
│ │ 📁  │ │ Projects    │                               │ │
│ │     │ │ Tags        │                               │ │
│ │     │ │             │                               │ │
│ └─────┘ └─────────────┴───────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Environment Variables

### Backend (`.env`)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=sb_publishable_xxx          # Anon key (RLS)
SUPABASE_SERVICE_KEY=sb_secret_xxx       # Service key (bypasses RLS)
MICROSOFT_CLIENT_ID=                     # Azure AD app
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/auth/microsoft/callback
FRONTEND_URL=http://localhost:3000       # CORS origin
DEBUG=true
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running Locally

### With Docker
```bash
docker-compose up
```

### Without Docker
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs
