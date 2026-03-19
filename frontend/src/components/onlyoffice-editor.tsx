"use client";

import { useEffect, useRef, useState } from "react";

interface OnlyofficeEditorProps {
  config: Record<string, unknown> | null;
  onlyofficeUrl: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSaved?: () => void;
  mode?: "edit" | "view";
  containerId?: string;
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: Record<string, unknown>) => {
        destroyEditor: () => void;
      };
    };
  }
}

export function OnlyofficeEditor({
  config,
  onlyofficeUrl,
  loading,
  error,
  onClose,
  onSaved,
  mode = "edit",
  containerId = "onlyoffice-editor-container",
}: OnlyofficeEditorProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Keep stable refs for callbacks so they don't trigger editor re-creation
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // Load the ONLYOFFICE api.js script
  useEffect(() => {
    if (!onlyofficeUrl) return;

    const scriptId = "onlyoffice-api-script";
    const existing = document.getElementById(scriptId);
    if (existing) {
      // Script already loaded — check if DocsAPI is available
      if (window.DocsAPI) {
        setScriptLoaded(true);
      } else {
        // Script tag exists but hasn't finished loading yet
        existing.addEventListener("load", () => setScriptLoaded(true), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () =>
      setEditorError(
        "Failed to load ONLYOFFICE editor. Is the Document Server running?"
      );
    document.head.appendChild(script);
  }, [onlyofficeUrl]);

  // Initialize the editor once — only depends on scriptLoaded and config identity
  useEffect(() => {
    if (!scriptLoaded || !config || !window.DocsAPI) return;

    // Prevent double-init (React Strict Mode)
    if (editorRef.current) return;

    const events: Record<string, unknown> = {
      onAppReady: () => {
        console.log(`[MDDoc] ONLYOFFICE ${mode} ready`);
        setEditorReady(true);
      },
      onError: (event: { data: unknown }) => {
        console.error("[MDDoc] ONLYOFFICE error:", event.data);
        setEditorError("Editor encountered an error");
      },
    };

    if (mode === "edit") {
      events.onDocumentStateChange = (event: { data: boolean }) => {
        if (!event.data) {
          console.log("[MDDoc] ONLYOFFICE document saved");
          onSavedRef.current?.();
        }
      };
      events.onRequestClose = () => {
        onCloseRef.current();
      };
    }

    const editorConfig = {
      ...config,
      height: "800px",
      width: "100%",
      documentType: "word",
      events,
    };

    try {
      console.log(`[MDDoc] Creating ONLYOFFICE ${mode}`);
      editorRef.current = new window.DocsAPI.DocEditor(
        containerId,
        editorConfig
      );
    } catch (err) {
      console.error("[MDDoc] Failed to create ONLYOFFICE editor:", err);
      setEditorError("Failed to initialize the editor");
    }

    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, config]);

  if (error || editorError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-sm text-red-600">{error || editorError}</p>
        {mode === "edit" && (
          <button
            onClick={onClose}
            className="text-sm text-[#4c573e] hover:underline"
          >
            Back to preview
          </button>
        )}
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
        <span className="ml-3 text-sm text-[#94908a]">
          {mode === "view" ? "Loading preview..." : "Loading editor..."}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {!editorReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
          <span className="ml-3 text-sm text-[#94908a]">
            {mode === "view" ? "Loading document..." : "Connecting to editor..."}
          </span>
        </div>
      )}
      <div
        id={containerId}
        style={{ height: "800px", width: "100%" }}
      />
    </div>
  );
}
