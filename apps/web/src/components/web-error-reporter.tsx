"use client";

import { useEffect } from "react";
import { installWebErrorReporting } from "@/lib/report-error";

/**
 * Installs the window-level error / unhandledrejection listeners once, so
 * runtime errors outside a React render (async handlers, event callbacks) also
 * reach the in-house error monitor. Rendered once from the root layout.
 */
export function WebErrorReporter() {
  useEffect(() => {
    installWebErrorReporting();
  }, []);
  return null;
}
