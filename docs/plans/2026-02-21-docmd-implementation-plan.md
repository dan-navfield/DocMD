# DocMD — Implementation Plan

**Date:** 2026-02-21

## Phase 1: Foundation (do first — everything depends on this)

### 1.1 Project scaffolding
- Initialize git repo
- Create monorepo structure: `backend/`, `frontend/`, `supabase/`
- Backend: FastAPI project with Poetry/pip, base config, CORS, health endpoint
- Frontend: Next.js 14 with Tailwind + shadcn/ui, base layout
- Docker Compose for local dev (backend + frontend + Supabase local)

### 1.2 Supabase schema + auth
- Write SQL migration: all tables from the design doc
- Configure Supabase Auth (email/password)
- Set up RLS policies for all tables
- Create Supabase Storage buckets: `markdown-sources`, `templates`, `generated-docs`
- Set up Supabase client in both backend and frontend

### 1.3 Backend core structure
- FastAPI app with router structure
- Pydantic models for all entities
- Supabase Python client integration
- Base CRUD service pattern
- Auth middleware (JWT validation + API key validation)
- Error handling + response formatting

## Phase 2: Core Features (can be parallelised)

### 2.1 Conversion Engine (CRITICAL PATH)
- Markdown parser using mistune — parse to AST
- Template reader — extract available styles from .docx
- Converter — walk AST + apply mapping rules → python-docx document
- Validator — check for unmapped elements, missing styles
- Report generator — produce conversion report JSON
- Tests with sample Markdown + sample Word template

### 2.2 Document Management API
- Documents CRUD router + service
- Document versions (create version on each update)
- File upload to Supabase Storage (Markdown files)
- Metadata handling (title, system, version, classification, author)
- Status management (received → converted → exported)
- List with filters (status, type, project, tags, date)
- Audit log entries for all operations

### 2.3 Template & Mapping Management API
- Templates CRUD — upload .docx, store in Supabase Storage
- Template style extraction — read a .docx and list all defined styles
- Mappings CRUD — create/update mapping rules JSON
- Mapping versioning
- Default mapping per project

### 2.4 Project Management API
- Projects CRUD
- Project members (invite, roles)
- Project defaults (template, mapping, destination)
- Naming rules configuration

### 2.5 Frontend Shell + Document Pages
- Root layout: icon nav + secondary sidebar + main content
- Documents list page with filter bar
- Document detail page (markdown preview, metadata, history)
- New document modal (upload .md, paste, metadata form)
- Status badges, tags, smart views
- Supabase Auth integration (login/signup pages)
- API client library

## Phase 3: Advanced Features (can be parallelised)

### 3.1 Document Agent
- LLM provider abstraction (Protocol class)
- Anthropic provider (Claude API)
- OpenAI provider (OpenAI API)
- Classifier — identify doc type from content
- Recommender — suggest template + mapping + folder
- Organizer — propose folder structure
- Agent API endpoints
- Settings page for LLM API key configuration
- Agent suggestion UI component in document detail

### 3.2 Export & SharePoint Integration
- Destinations CRUD
- Azure AD app registration setup docs
- Microsoft OAuth flow (MSAL + Supabase Auth Microsoft provider)
- SharePoint service — folder creation, file upload via Graph API
- Export API endpoints
- Export status tracking
- Folder path template resolution with variables
- Settings page for Microsoft connection

### 3.3 Frontend — Templates, Mappings, Projects Pages
- Templates page — list, upload, style preview
- Mapping editor page — visual editor with dropdowns
- Projects page — list, detail, member management
- Destinations configuration within project detail
- Folder structure visualization

### 3.4 MCP Server
- MCP Python SDK integration
- Tool definitions for all MCP tools
- API key auth for MCP connections
- Full pipeline tool (submit → classify → convert → export)
- Test with Claude Desktop / Claude Code

## Phase 4: Polish & Governance

### 4.1 Reporting & Audit
- Conversion report display in UI
- Audit log viewer (admin)
- Export history per document

### 4.2 Permissions & Security
- RLS policy refinement
- Role-based UI (hide actions user can't perform)
- API key management page

### 4.3 Settings & Configuration
- Settings page assembly (LLM, Microsoft, API keys, preferences)
- Naming rules editor
- Default configuration management

## Parallel Execution Strategy

```
Phase 1 (sequential — foundation)
  1.1 Scaffolding
  1.2 Schema + Auth
  1.3 Backend core
      │
      ├──────────────────────────────────────┐
      │                                      │
Phase 2 (parallel agents)                    │
  Agent A: 2.1 Conversion Engine             │
  Agent B: 2.2 Document API + 2.4 Projects   │
  Agent C: 2.3 Templates & Mappings API      │
  Agent D: 2.5 Frontend Shell + Doc Pages    │
      │                                      │
      ├──────────────────────────────────────┐
      │                                      │
Phase 3 (parallel agents)                    │
  Agent E: 3.1 Document Agent                │
  Agent F: 3.2 SharePoint Integration        │
  Agent G: 3.3 Frontend remaining pages      │
  Agent H: 3.4 MCP Server                   │
      │                                      │
      │                                      │
Phase 4 (parallel agents)                    │
  Agent I: 4.1 Reporting UI                  │
  Agent J: 4.2 Permissions + 4.3 Settings    │
```
