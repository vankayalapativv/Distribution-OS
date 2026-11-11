"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Small reusable URL-state hook: read/write individual query params so view state
 * survives the browser Back button, refresh, and sharing.
 *
 * Two write modes, by intent:
 *  - "replace" (default) — filters, tabs, search, pagination. No history entry, so
 *    tweaking a filter doesn't pollute Back.
 *  - "push" — "navigational" state like a detail drawer or a drill-down. Opening it
 *    adds a history entry, so the browser Back button CLOSES it.
 *
 * For full data-table lists (filters + sort + page together) prefer the
 * purpose-built `useTableUrlState`. Use this hook for single params: a tab, a
 * status filter, a selected id / open drawer, a dashboard period or drill-down.
 */
type WriteMode = "push" | "replace";

export interface UrlState {
  /** Current value of `key` ("" when absent). */
  get: (key: string) => string;
  /** Set/clear several params in one write (falsy value → delete the param). */
  set: (patch: Record<string, string | null | undefined>, mode?: WriteMode) => void;
}

export function useUrlState(): UrlState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spString = searchParams.toString();

  const get = useCallback((key: string) => new URLSearchParams(spString).get(key) ?? "", [spString]);

  const set = useCallback(
    (patch: Record<string, string | null | undefined>, mode: WriteMode = "replace") => {
      const next = new URLSearchParams(spString);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [spString, pathname, router],
  );

  return { get, set };
}

/**
 * Convenience wrapper for a single param: `const [tab, setTab] = useUrlParam("tab")`.
 * `history: "push"` makes setting it a Back target (for drawers/drill-downs);
 * the default "replace" is for filters/tabs. `defaultValue` is returned when the
 * param is absent (it is not written to the URL).
 */
export function useUrlParam(
  key: string,
  opts?: { history?: WriteMode; defaultValue?: string },
): readonly [string, (value: string | null) => void] {
  const { get, set } = useUrlState();
  const raw = get(key);
  const value = raw || (opts?.defaultValue ?? "");
  const setValue = useCallback(
    (v: string | null) => set({ [key]: v }, opts?.history ?? "replace"),
    [set, key, opts?.history],
  );
  return [value, setValue] as const;
}
