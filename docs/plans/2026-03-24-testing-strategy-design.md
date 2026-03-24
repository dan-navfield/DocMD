# MDDoc Testing Strategy Design

**Goal:** Build comprehensive test coverage starting with the conversion engine (highest-value, most bugs), then expanding to API endpoints, services, and critical E2E user journeys.

**Approach:** Three-layer test pyramid — engine unit tests, backend integration tests, thin E2E layer.

---

## Layer 1: Engine Unit Tests (pytest)

Pure function tests — no database, no network. Fast and deterministic.

### Structure

```
backend/tests/
├── conftest.py                    # Shared fixtures (template builders, sample markdown)
├── engine/
│   ├── conftest.py                # Engine-specific fixtures
│   ├── test_parser.py             # Markdown → AST
│   ├── test_converter.py          # Full conversion pipeline
│   ├── test_template_reader.py    # Style extraction
│   ├── test_validator.py          # Mapping validation
│   └── fixtures/
│       ├── sample_template.docx   # Real multi-section template
│       └── simple_template.docx   # Minimal single-section template
```

### test_parser.py — Markdown → AST

- Headings (h1–h6), paragraphs, inline formatting (bold, italic, code)
- Ordered/unordered lists, nested lists (3 levels deep)
- Tables with headers, code blocks with language tags
- Blockquotes, thematic breaks, images, links
- Edge cases: empty document, only whitespace, deeply nested structures

### test_converter.py — Full conversion pipeline

- **Template shapes:** single-section, 2-section (cover + body), 3+ section (cover + body + final)
- **Element rendering:** each markdown element type produces correct Word styles
- **Mapping rules:** style names applied correctly, missing styles fall back gracefully
- **Cover page:** title replacement, metadata clearing (auto mode + explicit mode)
- **Page breaks:** `page_break_before` rules honored
- **Edge cases:** empty markdown, template with no styles, mapping with missing fields, corrupted template bytes

### test_template_reader.py — Style extraction

- Returns paragraph and character styles
- Handles templates with no custom styles
- Handles templates with duplicate style names

### test_validator.py — Mapping validation

- Warns on styles referenced but missing from template
- Warns on unmapped AST element types
- Passes cleanly when everything matches

### Fixture strategy

- **Programmatic templates:** python-docx builders for unit tests (precise control, no binary files)
- **Real templates:** 1-2 committed .docx files for integration tests (catches real-world quirks like InDesign style IDs)

---

## Layer 2: Backend Integration Tests (pytest + local Supabase)

### Structure

```
backend/tests/
├── services/
│   ├── test_conversion_service.py   # Conversion orchestration
│   ├── test_document_service.py     # Document CRUD
│   └── test_billing_service.py      # Quota checks
├── api/
│   ├── conftest.py                  # FastAPI TestClient, auth helpers
│   ├── test_documents_api.py        # /api/documents endpoints
│   ├── test_conversions_api.py      # /api/documents/{id}/convert + download
│   ├── test_templates_api.py        # /api/templates endpoints
│   ├── test_mappings_api.py         # /api/mappings endpoints
│   └── test_auth.py                 # JWT + API key auth flows
└── integration/
    ├── conftest.py                  # Local Supabase connection, seed data
    ├── test_full_conversion.py      # Upload md → convert → download .docx
    └── test_rls_policies.py         # Verify row-level security
```

### Service tests (mocked Supabase — fast)

- `ConversionService`: document/template/mapping lookup, storage upload/download, status transitions, error handling
- `DocumentService`: CRUD, version incrementing, content storage
- `BillingService`: quota checks, tier-based feature gating, period resets

### API endpoint tests (FastAPI TestClient)

- Correct status codes (200, 400, 401, 403, 404, 422, 500)
- Auth enforcement: no token → 401, wrong user → 403
- Request validation: missing required fields → 422
- File upload handling for documents and templates
- Conversion endpoint returns `ConversionResponse` shape
- Error envelope format for `/api/v1/` vs regular endpoints

### Integration tests (real local Supabase via docker-compose)

- Full pipeline: create doc → upload markdown → convert → download .docx → verify it opens
- RLS policy tests: user A can't read user B's documents, project member access respects roles
- Test missing UPDATE policies (conversions, exports, document_versions)

---

## Layer 3: E2E Tests (Playwright)

Thin layer — only journeys that cross multiple systems.

### Structure

```
frontend/e2e/
├── playwright.config.ts        # Config: base URL, timeouts, browsers
├── helpers/
│   ├── auth.ts                 # Login helper, session management
│   └── seed.ts                 # Create test data via API
├── documents.spec.ts           # Document lifecycle
├── conversion.spec.ts          # Critical conversion path
└── error-handling.spec.ts      # Verify toasts on failures
```

### conversion.spec.ts — Critical user journey

- Login → create new document → verify redirect to editor
- Edit markdown → save → verify "Saved" indicator
- Select template + mapping → Convert → verify post-convert view
- Download .docx → verify non-empty file
- Change mapping rule → verify live re-conversion

### documents.spec.ts — Document lifecycle

- New Document button creates doc and navigates to editor
- Document list shows created documents
- Search and status filter work
- Delete → confirm → removed from list

### error-handling.spec.ts — Toast verification

- Invalid API response → toast appears
- Network failure → toast appears
- Expired session → redirect to login

---

## Infrastructure

### Dependencies

```
# backend/requirements-test.txt
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.27.2
pytest-cov==6.0.0

# frontend (devDependencies)
@playwright/test
```

### Running tests

```bash
# Engine tests only (fast, no dependencies)
cd backend && pytest tests/engine/ -v

# All backend tests (needs local Supabase)
docker compose up supabase-db -d
cd backend && pytest -v

# E2E (needs full stack)
docker compose up -d
cd frontend && npx playwright test

# Coverage
cd backend && pytest --cov=app --cov-report=html
```

### CI (GitHub Actions)

- **On PR:** engine unit tests + API tests with mocked Supabase (fast, no Docker)
- **On merge to main:** full suite including integration tests (supabase-db service container) + Playwright E2E
- **Coverage gate:** engine coverage must stay above 80%

### Test data strategy

- Engine tests: self-contained fixtures, no external state
- Service/API tests: mock Supabase responses in fixtures
- Integration tests: seed in conftest.py, clean up via transaction rollback
- E2E tests: seed via API in beforeAll, clean up in afterAll

---

## Implementation order

1. Engine unit tests (highest value, zero dependencies)
2. Backend API + service tests
3. Integration tests with local Supabase
4. E2E with Playwright
