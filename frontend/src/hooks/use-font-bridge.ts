"use client";

import { useEffect, useRef, useState } from "react";
import { fonts as fontsApi } from "@/lib/api";
import { formatFromMime, inferWeightAndStyle, bridgeDocxFonts } from "@/lib/font-utils";
import type { Font } from "@/lib/types";

export interface FontBridgeResult {
  fontsLoaded: boolean;
  fontList: Font[];
  fontCssRules: string;
  fontBlobUrls: Map<string, string>;
  registeredNames: Set<string>;
  loadedFontFaces: FontFace[];
  /** Call after docx-preview render to bridge missing fonts */
  bridgeFonts: (container: HTMLElement) => FontFace[];
}

export function useFontBridge(): FontBridgeResult {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontList, setFontList] = useState<Font[]>([]);
  const [fontCssRules, setFontCssRules] = useState<string>("");
  const fontBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const loadedFontFacesRef = useRef<FontFace[]>([]);
  const registeredNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadFonts() {
      try {
        const fonts = await fontsApi.list();
        if (cancelled) return;
        setFontList(fonts);

        if (fonts.length === 0) {
          setFontsLoaded(true);
          return;
        }

        const rules: string[] = [];
        const blobMap = new Map<string, string>();
        const faces: FontFace[] = [];
        const registered = new Set<string>();

        for (const font of fonts) {
          try {
            const blob = await fontsApi.fetchFile(font.id);
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            blobMap.set(font.id, url);

            const aliases = font.font_aliases?.length
              ? font.font_aliases
              : [font.family];
            const allNames = Array.from(new Set([font.family, ...aliases]));
            const fmt = formatFromMime(font.mime_type);
            const { weight, style } = inferWeightAndStyle(allNames);

            for (const name of allNames) {
              const fontFace = new FontFace(
                name,
                `url("${url}") format("${fmt}")`,
                { weight, style }
              );
              await fontFace.load();
              document.fonts.add(fontFace);
              faces.push(fontFace);
              registered.add(name.toLowerCase());

              rules.push(`@font-face {
  font-family: "${name}";
  src: url("${url}") format("${fmt}");
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`);
            }
          } catch {
            console.warn(`Failed to load font file: ${font.name}`);
          }
        }

        if (cancelled) return;

        fontBlobUrlsRef.current = blobMap;
        loadedFontFacesRef.current = faces;
        registeredNamesRef.current = registered;
        const cssRulesStr = rules.join("\n");
        setFontCssRules(cssRulesStr);

        // Inject into document head as fallback
        const styleEl = document.createElement("style");
        styleEl.id = "mddoc-custom-fonts";
        styleEl.textContent = cssRulesStr;
        document.head.appendChild(styleEl);

        setFontsLoaded(true);
      } catch {
        if (!cancelled) setFontsLoaded(true);
      }
    }

    loadFonts();

    return () => {
      cancelled = true;
      loadedFontFacesRef.current.forEach((f) => {
        try { document.fonts.delete(f); } catch { /* ignore */ }
      });
      loadedFontFacesRef.current = [];
      fontBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      fontBlobUrlsRef.current = new Map();
      registeredNamesRef.current = new Set();
      const el = document.getElementById("mddoc-custom-fonts");
      if (el) el.remove();
    };
  }, []);

  const bridgeFonts = (container: HTMLElement): FontFace[] => {
    const bridged = bridgeDocxFonts(
      container,
      fontList,
      fontBlobUrlsRef.current,
      registeredNamesRef.current,
    );
    loadedFontFacesRef.current.push(...bridged);
    return bridged;
  };

  return {
    fontsLoaded,
    fontList,
    fontCssRules,
    fontBlobUrls: fontBlobUrlsRef.current,
    registeredNames: registeredNamesRef.current,
    loadedFontFaces: loadedFontFacesRef.current,
    bridgeFonts,
  };
}
