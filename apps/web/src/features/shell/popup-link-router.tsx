"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * One delegated click handler for internal links inside Leaflet map popups.
 *
 * Map popups are built as raw HTML strings (e.g. customerDotPopup / the tracking
 * visit popup) and injected via Leaflet `bindPopup`, so their `<a href="/…">`
 * links can't be Next `<Link>`s — a plain click would trigger a FULL page reload
 * and wipe the SPA (map view, list filters, scroll, history). This listener
 * intercepts a left-click on any internal link that sits inside a `.leaflet-popup`
 * and routes it through the Next router instead, so the browser Back button keeps
 * the previous view. Everything outside a map popup is untouched (ordinary
 * `<Link>`s and the deliberate hard-refresh anchors keep their behaviour).
 *
 * Mounted once in the dashboard layout; renders nothing.
 */
export function PopupLinkRouter() {
  const router = useRouter();
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Let modified clicks (new tab/window), non-left clicks, and already-handled
      // events fall through to the browser.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !a.closest(".leaflet-popup")) return; // only links inside a map popup
      if (a.target && a.target !== "_self") return; // respect target="_blank"
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return; // internal routes only
      e.preventDefault();
      router.push(href);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);
  return null;
}
