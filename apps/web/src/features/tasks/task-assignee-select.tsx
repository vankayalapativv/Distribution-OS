"use client";

import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import type { TaskAssignee } from "./tasks-api";

interface Option { id: string; name: string; meta: string }
const roleLabel = (role: string) => role.replaceAll("_", " ").toLowerCase();

/** "Assign to" dropdown — searchable; Unassigned + everyone with their role as
 *  muted sub-text (office roles and sales executives in one filterable list). */
export function TaskAssigneeSelect({
  value, onChange, officeAssignees, seAssignees,
}: {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly selectedAssignee: TaskAssignee | null;
  readonly officeAssignees: TaskAssignee[];
  readonly seAssignees: TaskAssignee[];
}) {
  const items: Option[] = [
    { id: "", name: "Unassigned", meta: "" },
    ...officeAssignees.map((a) => ({ id: a.id, name: a.name, meta: roleLabel(a.role) })),
    ...seAssignees.map((a) => ({ id: a.id, name: a.name, meta: roleLabel(a.role) })),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Assign to</Label>
      <SearchSelect
        items={items}
        valueKey={value}
        getKey={(x) => x.id}
        getLabel={(x) => x.name}
        onSelect={onChange}
        placeholder="Unassigned"
        searchPlaceholder="Search person…"
        emptyText="No one found"
        contentClassName="w-[320px] p-0"
        renderOption={(x) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{x.name}</span>
            {x.meta ? <span className="truncate text-xs text-muted-foreground">{x.meta}</span> : null}
          </span>
        )}
      />
    </div>
  );
}
