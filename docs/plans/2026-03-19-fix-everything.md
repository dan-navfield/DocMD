# Fix Everything Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken "New Document" button, add toast notifications, improve error handling across frontend and backend, harden security, and clean up config.

**Architecture:** Frontend gets sonner toast library + proper error handling on all API calls. "New Document" creates a document via API and redirects to editor. Backend gets config validation, specific exception handling, and CORS tightening. Docker compose gets env var references for secrets.

**Tech Stack:** Next.js 16, React 19, sonner (toast), FastAPI, Supabase, Docker Compose

---

### Task 1: Install sonner and wire up toast provider

**Files:**
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Install sonner**

Run: `cd frontend && npm install sonner`

**Step 2: Add Toaster to layout**

In `frontend/src/app/layout.tsx`, add `import { Toaster } from "sonner"` and place `<Toaster richColors position="top-right" />` inside the `<body>` tag, after `<AppShell>`.

---

### Task 2: Fix "New Document" button — create document and navigate to editor

**Files:**
- Modify: `frontend/src/app/documents/page.tsx`
- Modify: `frontend/src/components/layout/sidebar.tsx`

The "New Document" button currently links to `/documents?new=true` which does nothing. Change both buttons to call the API to create a new untitled document, then navigate to `/documents/[id]` in edit mode.

**documents/page.tsx changes:**
- Add `useRouter` import
- Replace the `<Link href="/documents?new=true">` hero CTA with a `<Button onClick={handleNewDocument}>`
- Add `handleNewDocument` function that:
  1. Creates a FormData with `title: "Untitled Document"` and `markdown: "# Untitled Document\n\nStart writing..."`
  2. Calls `docsApi.create(formData)`
  3. Navigates to `/documents/${newDoc.id}`
  4. Shows error toast on failure
- Same for the empty state button

**sidebar.tsx changes:**
- Convert from `<Link>` to a `<button>` that calls the same create-and-navigate pattern
- Need to import `useRouter` and API

---

### Task 3: Add error toasts to documents list page

**Files:**
- Modify: `frontend/src/app/documents/page.tsx`

Replace `.catch(() => setDocs([]))` with proper error handling that shows a toast and sets an error state so the UI shows "Failed to load" instead of "No documents yet".

---

### Task 4: Add error toasts to document detail page

**Files:**
- Modify: `frontend/src/app/documents/[id]/page.tsx`

Replace all `console.error` catches with `toast.error()`:
- Data loading (line 119-125)
- Save handler (line 139)
- Classification (line 173)
- Conversion (line 236)
- Re-conversion (line 267)
- Save mapping (line 313)
- Download (line 344)
- Delete (line 354)

---

### Task 5: Add error toasts to all other pages

**Files:**
- Modify: `frontend/src/app/templates/page.tsx`
- Modify: `frontend/src/app/templates/[id]/page.tsx`
- Modify: `frontend/src/app/mappings/page.tsx`
- Modify: `frontend/src/app/mappings/[id]/page.tsx`
- Modify: `frontend/src/app/projects/page.tsx`
- Modify: `frontend/src/app/projects/[id]/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`

Add `import { toast } from "sonner"` and replace all `.catch(console.error)`, `.catch(() => [])`, and silent failures with `toast.error("descriptive message")`.

---

### Task 6: Consolidate auth provider

**Files:**
- Modify: `frontend/src/components/auth-provider.tsx`

Remove the redundant second `useEffect` (lines 35-39). The `onAuthStateChange` listener already handles redirect on logout. The second effect causes duplicate redirects.

---

### Task 7: Backend config validation

**Files:**
- Modify: `backend/app/config.py`

Add a `model_validator` that checks `supabase_url` and `supabase_key` are non-empty on startup. App should fail fast with a clear error instead of silently breaking.

---

### Task 8: Backend — replace bare except blocks in dependencies

**Files:**
- Modify: `backend/app/dependencies.py`

Replace `except Exception: pass` (lines 49, 73) with specific exception handling:
- Catch `Exception` but log it as debug (expected flow — trying JWT then API key)

---

### Task 9: Docker compose — externalize secrets

**Files:**
- Modify: `docker-compose.yml`

Replace hardcoded `JWT_SECRET` and `POSTGRES_PASSWORD` with env var references (`${ONLYOFFICE_JWT_SECRET:-mddoc-onlyoffice-jwt-secret}` and `${POSTGRES_PASSWORD:-postgres}`).

---

### Task 10: CORS — restrict methods

**Files:**
- Modify: `backend/app/main.py`

Replace `allow_methods=["*"]` with explicit list: `allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`.

---
