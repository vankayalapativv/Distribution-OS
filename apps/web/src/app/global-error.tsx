"use client";

import { useEffect } from "react";
import { reportWebError } from "@/lib/report-error";

/**
 * Last-resort boundary — shown only if the ROOT LAYOUT itself throws, which
 * bypasses the normal layout (and its global CSS). It must therefore render its
 * own <html>/<body> and can't rely on Tailwind, so everything here is inlined.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] global error:", error);
    reportWebError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb" }}>Sri Aparajitha Enterprise</div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Distribution OS
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#64748b", margin: 0 }}>
          The app hit an unexpected error. Please reload the page.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 4,
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
