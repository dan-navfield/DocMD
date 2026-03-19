"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface DocxPreviewPaneProps {
  docxData: ArrayBuffer | null;
  loading?: boolean;
  reconverting?: boolean;
  fontsLoaded?: boolean;
  fontCssRules?: string;
  onRendered?: (container: HTMLElement) => void;
  maxHeight?: string;
}

export function DocxPreviewPane({
  docxData,
  loading = false,
  reconverting = false,
  fontsLoaded = true,
  fontCssRules,
  onRendered,
  maxHeight = "800px",
}: DocxPreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    if (!docxData || !fontsLoaded || !previewRef.current) return;

    let cancelled = false;
    setRendering(true);
    previewRef.current.innerHTML = "";

    import("docx-preview").then(({ renderAsync }) => {
      if (cancelled || !previewRef.current) return;
      renderAsync(docxData, previewRef.current, undefined, {
        className: "docx-preview-wrapper",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
      })
        .then(() => {
          if (cancelled || !previewRef.current) return;
          // Inject font CSS rules inside the preview container
          if (fontCssRules) {
            const wrapperStyle = document.createElement("style");
            wrapperStyle.textContent = fontCssRules;
            previewRef.current.prepend(wrapperStyle);
          }
          onRendered?.(previewRef.current);
          setRendering(false);
        })
        .catch((err) => {
          console.error("docx-preview render error:", err);
          if (!cancelled) setRendering(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [docxData, fontsLoaded, fontCssRules, onRendered]);

  const showLoading = loading || (rendering && !!docxData);

  return (
    <div className="relative flex-1 min-w-0 overflow-auto" style={{ maxHeight }}>
      {showLoading && !reconverting && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4c573e] border-t-transparent" />
          <span className="ml-3 text-sm text-[#94908a]">Rendering document...</span>
        </div>
      )}

      {/* Semi-transparent spinner overlay during re-conversion */}
      {reconverting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-lg border border-[#dddacc]">
            <RefreshCw className="h-4 w-4 animate-spin text-[#4c573e]" />
            <span className="text-sm font-medium text-[#44403a]">Re-converting...</span>
          </div>
        </div>
      )}

      {!docxData && !loading && (
        <div className="flex items-center justify-center py-16 text-sm text-[#94908a]">
          No document to preview
        </div>
      )}

      <div
        ref={previewRef}
        className={cn(showLoading && !reconverting && "hidden")}
      />
    </div>
  );
}
