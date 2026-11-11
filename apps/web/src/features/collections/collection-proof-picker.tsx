"use client";

import { useEffect, useMemo } from "react";
import { FileText, ImagePlus, X } from "lucide-react";
import { FieldLabel } from "./collection-field-label";

/** Required image/PDF proof — mirrors the SE mobile receipt upload. */
export function ProofPicker({ file, onChange }: { readonly file: File | null; readonly onChange: (file: File | null) => void }) {
  // Object URL for the image preview, available synchronously. The effect below
  // revokes the previous URL whenever it changes or the component unmounts.
  const preview = useMemo(
    () => (file && file.type !== "application/pdf" ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required>Payment Proof</FieldLabel>
      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-2">
          {(() => { if (file.type === "application/pdf") return (
            <div className="flex size-14 items-center justify-center rounded bg-muted text-muted-foreground">
              <FileText className="size-6" />
            </div>
          ); if (preview) return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Proof preview" className="size-14 rounded object-cover" />
          ); return (
            <div className="size-14 rounded bg-muted" />
          ); })()}
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Remove proof"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <ImagePlus className="size-4 shrink-0" />
          <span>Upload receipt photo or PDF (JPEG / PNG / WebP / PDF)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
