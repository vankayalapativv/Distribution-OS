"use client";

/**
 * Code-splits the Reports view: its JS (tables + TanStack Query + the export
 * code path) loads on demand as a separate chunk, keeping it out of the initial
 * dashboard bundle. A full-page skeleton shows while the chunk downloads.
 */
import dynamic from "next/dynamic";
import { type ActionConfig } from "@/lib/api-client";
import { ReportsPageSkeleton } from "./reports-skeletons";

const ReportsView = dynamic(() => import("./reports-view").then((m) => m.ReportsView), {
  ssr: false,
  loading: () => <ReportsPageSkeleton />,
});

export function ReportsViewLazy(props: { readonly actionConfig: ActionConfig; readonly role: string }) {
  return <ReportsView {...props} />;
}
