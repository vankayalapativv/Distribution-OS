"use client";

import { Bell } from "lucide-react";

/** Clickable "N new … — click to load" strip shown above a list when fresh
 *  items have arrived since the page opened. Hidden when count is 0. */
export function NewItemsBanner({
  count,
  noun,
  onLoad,
}: {
  readonly count: number;
  readonly noun: string;
  readonly onLoad: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onLoad}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
    >
      <Bell size={14} />
      {count} new {noun}
      {count !== 1 ? "s" : ""} — click to load
    </button>
  );
}
