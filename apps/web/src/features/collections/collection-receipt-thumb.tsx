"use client";

import { FileText } from "lucide-react";

/** The receipt thumbnail: loading / failed / PDF / image states. */
export function CollectionReceiptThumb({
  src, failed, isPdf, onEnlarge,
}: {
  readonly src: string | null;
  readonly failed: boolean;
  readonly isPdf: boolean;
  readonly onEnlarge: () => void;
}) {
  if (failed) return <p className="text-sm text-muted-foreground">Couldn&apos;t load the receipt.</p>;
  if (!src) return <div className="h-40 w-32 animate-pulse rounded-lg bg-slate-200" />;
  if (isPdf) {
    return (
      <button
        type="button"
        onClick={() => window.open(src, "_blank", "noopener")}
        className="flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground transition hover:bg-accent"
        title="Open PDF in a new tab"
      >
        <FileText className="size-8" />
        <span className="text-xs font-medium">Open PDF</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onEnlarge}
      className="group relative block overflow-hidden rounded-lg border border-border" title="Click to enlarge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Payment receipt" className="h-40 w-32 object-cover transition group-hover:opacity-90" />
      <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-[11px] font-medium text-white">
        Click to enlarge
      </span>
    </button>
  );
}
