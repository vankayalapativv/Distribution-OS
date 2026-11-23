"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ConfigurableRole, PermissionCatalogEntry } from "./permissions-api";
import { PermissionSwitch } from "./permission-switch";
import {
  diffCounts,
  enabledCount,
  PRESETS,
  ROLE_LABEL,
  type PresetId,
  type RoleMap,
} from "./permissions-presets";

export function RolePanel({
  role,
  catalog,
  map,
  base,
  query,
  onToggle,
  onPreset,
}: {
  readonly role: ConfigurableRole;
  readonly catalog: PermissionCatalogEntry[];
  readonly map: RoleMap;
  readonly base: RoleMap;
  readonly query: string;
  readonly onToggle: (role: ConfigurableRole, key: string) => void;
  readonly onPreset: (role: ConfigurableRole, preset: PresetId) => void;
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const total = catalog.length;
  const on = enabledCount(map, catalog);
  const { added, removed } = diffCounts(map, base, catalog);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byGroup = new Map<string, PermissionCatalogEntry[]>();
    for (const e of catalog) {
      if (q && !e.label.toLowerCase().includes(q)) continue;
      const list = byGroup.get(e.group) ?? [];
      list.push(e);
      byGroup.set(e.group, list);
    }
    return [...byGroup.entries()];
  }, [catalog, query]);

  const pct = total === 0 ? 0 : Math.round((on / total) * 100);

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2.5 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-foreground">{ROLE_LABEL[role]}</h3>
            <span className="text-xs text-muted-foreground">
              {on} of {total} enabled
            </span>
          </div>
          {added > 0 || removed > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {added > 0 ? <span className="text-primary">+{added}</span> : null}
              {removed > 0 ? <span className="text-destructive">−{removed}</span> : null}
              <span className="text-muted-foreground">unsaved</span>
            </div>
          ) : null}
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center gap-2">
          <Popover open={presetOpen} onOpenChange={setPresetOpen}>
            <PopoverTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted focus:outline-none">
              <Sliders className="size-3.5" /> Preset <ChevronDown className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 gap-1 p-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPresetOpen(false);
                    onPreset(role, p.id);
                  }}
                  className="flex flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-muted"
                >
                  <span className="text-sm font-medium text-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.hint}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => onPreset(role, "full")}>
            Enable all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onPreset(role, "none")}>
            Clear
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No capabilities match.</p>
        ) : (
          groups.map(([group, entries]) => (
            <div key={group} className="flex flex-col gap-1">
              <p className="px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {entries.map((e) => {
                  const checked = map[e.key] ?? false;
                  const changed = checked !== (base[e.key] ?? false);
                  return (
                    <div
                      key={e.key}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md px-2 py-1.5",
                        changed ? "bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="truncate text-sm text-foreground">{e.label}</span>
                      <PermissionSwitch
                        checked={checked}
                        changed={changed}
                        label={`${e.label} for ${ROLE_LABEL[role]}`}
                        onToggle={() => onToggle(role, e.key)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
