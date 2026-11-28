"use client";

import type { ActionConfig } from "@/lib/api-client";
import { useBillBlob } from "./use-bill-blob";

/** Inline preview of an entry's already-attached proof, shown in the Edit form so
 *  you can see the receipt without leaving the form. Image inline, PDF in a frame. */
export function ExpenditureFormProof({ actionConfig, entryId }: { readonly actionConfig: ActionConfig; readonly entryId: string }) {
  const { src, isPdf, failed } = useBillBlob(actionConfig, entryId);
  if (failed) return <p className="text-xs text-muted-foreground">Couldn&apos;t load the attached bill.</p>;
  if (!src) return <div className="h-40 w-full animate-pulse rounded-md bg-slate-200" />;
  if (isPdf) return <iframe src={src} title="Attached bill" className="h-56 w-full rounded-md border border-border" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Attached bill" className="max-h-56 w-auto rounded-md border border-border" />
  );
}
