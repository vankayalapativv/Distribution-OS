"use client";

import { SearchSelect } from "@/components/ui/search-select";
import { STATUS_TABS, type StatusTabKey } from "./tasks-shared";

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

interface TasksFiltersProps {
  readonly statusTab: StatusTabKey;
  readonly onStatusTab: (key: StatusTabKey) => void;
  readonly mineOnly: boolean;
  readonly onToggleMine: () => void;
  readonly priorityFilter: string;
  readonly onPriorityFilter: (value: string) => void;
}

export function TasksFilters({
  statusTab,
  onStatusTab,
  mineOnly,
  onToggleMine,
  priorityFilter,
  onPriorityFilter,
}: TasksFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onStatusTab(tab.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            statusTab === tab.key
              ? "bg-primary text-primary-foreground"
              : "bg-white text-muted-foreground ring-1 ring-border hover:bg-accent"
          }`}
        >
          {tab.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        onClick={onToggleMine}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          mineOnly
            ? "bg-primary text-primary-foreground"
            : "bg-white text-muted-foreground ring-1 ring-border hover:bg-accent"
        }`}
      >
        My tasks
      </button>
      <SearchSelect
        items={PRIORITY_OPTIONS}
        valueKey={priorityFilter}
        getKey={(o) => o.value}
        getLabel={(o) => o.label}
        onSelect={onPriorityFilter}
        placeholder="All priorities"
        searchPlaceholder="Search…"
        emptyText="No match"
        contentClassName="w-[160px] p-0"
        triggerClassName="!h-7 !w-auto !rounded-full !border-0 !bg-white px-3 !text-xs font-medium text-muted-foreground ring-1 ring-border"
      />
    </div>
  );
}
