"use client";

import { cn } from "@/lib/utils";
import type { DetailTab } from "./customer-detail-tabs";

/** The horizontal, scrollable tab bar with per-tab count badges. */
export function CustomerDetailTabBar({
  tabs,
  activeTab,
  onSelect,
}: {
  readonly tabs: DetailTab[];
  readonly activeTab: string;
  readonly onSelect: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-0.5 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.key)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap px-4 pb-3.5 pt-3 text-sm font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full bg-primary/10 px-[7px] py-px text-[11px] font-bold text-primary">
                {tab.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
