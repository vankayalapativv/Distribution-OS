"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil, Plus, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { withQueryClient } from "@/components/data-table/query-provider";
import { type ActionConfig, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { createLocation, fetchLocations, renameLocation, type StockLocation } from "@/features/stock/stock-api";
import { SectionCard } from "./settings-card";

function GodownsInner({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  const q = useQuery({ queryKey: ["settings-godowns"], queryFn: () => fetchLocations(actionConfig) });
  const godowns = q.data ?? [];

  // read → just the godown pills; "add" → reveals the new-godown input; "manage"
  // → reveals the rename pencils. Both add & manage show the add row + "Done".
  const [mode, setMode] = useState<"read" | "add" | "manage">("read");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addName, setAddName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await q.refetch();
      return true;
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (g: StockLocation) => { setEditId(g.id); setEditName(g.name); setError(null); };
  const saveEdit = async () => {
    if (!editName.trim() || !editId) return;
    if (await run(() => renameLocation(actionConfig, editId, editName.trim()))) setEditId(null);
  };
  const add = async () => {
    if (!addName.trim()) return;
    // Name only. A new godown never steals "default" from an existing one; the
    // very first godown (none yet) becomes default so stock has a home.
    const ok = await run(() => createLocation(actionConfig, {
      name: addName.trim(), code: null, city: null, stateCode: "36", isDefault: godowns.length === 0,
    }));
    if (ok) setAddName("");
  };

  const action = mode !== "read"
    ? <Button variant="ghost" size="sm" className="h-8" onClick={() => { setMode("read"); setEditId(null); setError(null); }}>Done</Button>
    : (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8" onClick={() => setMode("add")}><Plus className="size-3.5" /> Add</Button>
        {godowns.length > 0 && <Button variant="outline" size="sm" className="h-8" onClick={() => setMode("manage")}><Pencil className="size-3.5" /> Edit</Button>}
      </div>
    );

  return (
    <SectionCard icon={<Warehouse className="size-[18px]" />} title="Godowns" description="Stock locations an invoice can draw from." action={action}>
      {(() => { if (q.isLoading) return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="rounded-lg border border-border px-3 py-3"><Skeleton className="h-4 w-32" /></div>)}
        </div>
      ); if (godowns.length === 0) return (
        <p className="rounded-lg border border-border px-3 py-5 text-center text-sm text-muted-foreground">No godowns yet. Add your first one below.</p>
      ); return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {godowns.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
              <Warehouse className="size-4 shrink-0 text-muted-foreground" />
              {editId === g.id ? (
                <>
                  <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape") setEditId(null); }}
                    className="h-8 min-w-0 flex-1" />
                  <Button size="sm" className="h-8 px-2" onClick={saveEdit} disabled={busy || !editName.trim()}><Check className="size-4" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditId(null)} disabled={busy}><X className="size-4" /></Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{g.name}</span>
                  {mode === "manage" && (
                    <Button size="sm" variant="ghost" className="size-8 p-0 text-muted-foreground" onClick={() => startEdit(g)} disabled={busy} aria-label={`Rename ${g.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ); })()}

      {(mode === "add" || mode === "manage" || godowns.length === 0) && (
        <div className="mt-3 flex items-center gap-2">
          <Input autoFocus={mode === "add"} value={addName} onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
            className={cn("h-9 w-full sm:w-72", editId !== null && "opacity-50")} disabled={editId !== null} />
          <Button className="h-9" onClick={add} disabled={busy || !addName.trim() || editId !== null}>
            <Plus className="size-4" /> Add godown
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </SectionCard>
  );
}

export const GodownsSection = withQueryClient(GodownsInner);
