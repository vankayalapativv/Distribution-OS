"use client";

import type { ReactNode } from "react";
import { AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A read-only detail row (label + value) used in a section's "read" state.
 *  Typographic layout: the label sits in a fixed left column, the value fills
 *  the rest — airy, no dividers. */
export function ReadRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</span>
      <span className="flex-1 text-sm text-foreground">{children}</span>
    </div>
  );
}

/** Muted placeholder for a read-out value that isn't set. */
export function ReadEmpty({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="italic text-muted-foreground">{children}</span>;
}

/** An editable field row: label (with a red * when required) + the input +
 *  an inline per-field error message beneath it. The input is passed as
 *  children so each caller controls its own error-border styling. */
export function EditRow({
  label, required, description, error, children,
}: Readonly<{
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-3.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:pt-1.5">
        <div className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </div>
        {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="w-full sm:w-72">
        {children}
        {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/** Red error-border classes for an input, applied when the field has an error. */
export const errBorder = (error?: string) =>
  error ? "border-destructive focus-visible:ring-destructive/30" : "";

/** The "Edit" affordance shown in a section's read state. */
export function EditButton({ label = "Edit", onClick }: Readonly<{ label?: string; onClick: () => void }>) {
  return (
    <Button variant="outline" size="sm" className="h-8" onClick={onClick}>
      <Pencil className="size-3.5" /> {label}
    </Button>
  );
}

/** A friendly top-level error banner for a failed save (network / server). */
export function SaveError({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
