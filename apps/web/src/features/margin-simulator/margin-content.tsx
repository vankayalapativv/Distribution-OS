"use client";

import { Suspense, use, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { downloadMarginXlsx } from "./margin-export";
import { MarginEntryDialog } from "./margin-entry-dialog";
import { MarginRow } from "./margin-row";
import { MarginRowsSkeleton } from "./margin-skeleton";
import { deleteSim } from "./margin-client";
import type { MarginSim, OilProduct } from "./margin-api";

const PAGE_SIZE = 10;

/** Shared search filter (product name or pack size) — used by both the rows and
 *  the pager so their view of "how many match" can never drift apart. */
function filterSims(all: MarginSim[], q: string): MarginSim[] {
  const query = q.trim().toLowerCase();
  if (!query) return all;
  return all.filter(
    (r) =>
      r.productName.toLowerCase().includes(query) ||
      String(r.packSize).includes(query) ||
      `${r.packSize} l`.includes(query),
  );
}

/**
 * The interactive Margin Simulator grid. The search box, New-simulation button
 * and table header render immediately; only the saved-simulation ROWS arrive via
 * `simsPromise` and shimmer (inner Suspense) — so the controls are never stuck in
 * a loading state. The dialog's oil catalogue arrives via `productsPromise`.
 */
export function MarginSimulatorContent({
  simsPromise,
  productsPromise,
  actionConfig,
}: {
  readonly simsPromise: Promise<MarginSim[]>;
  readonly productsPromise: Promise<OilProduct[]>;
  readonly actionConfig: ActionConfig;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MarginSim | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [downloading, setDownloading] = useState(false);

  // A new search restarts paging from the first page of the filtered results.
  const onSearch = (value: string) => {
    setQ(value);
    setPage(1);
  };

  // Export exactly what the search matches (all pages), resolving the rows on
  // click so the toolbar never suspends waiting for them.
  async function handleDownload() {
    setDownloading(true);
    try {
      const all = await simsPromise;
      await downloadMarginXlsx(filterSims(all, q));
    } finally {
      setDownloading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSim(actionConfig, deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "Failed to delete."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by product or pack size…"
            className="bg-white pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download className="size-4" /> {downloading ? "Preparing…" : "Download Excel"}
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New simulation
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Product</TableHead>
              <TableHead className="border-l border-border text-center">MRP</TableHead>
              <TableHead className="border-l border-border text-center">DLP</TableHead>
              <TableHead className="border-l border-border text-center">Exp / L</TableHead>
              <TableHead className="border-l border-border text-center">Scheme / L</TableHead>
              <TableHead className="border-l border-border text-center">Coupon</TableHead>
              <TableHead className="border-l border-border text-center">MOP</TableHead>
              <TableHead className="border-l border-border text-center">Margin / Pack</TableHead>
              <TableHead className="border-l border-border text-center">Margin / Liter</TableHead>
              <TableHead className="border-l border-border text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Suspense fallback={<MarginRowsSkeleton />}>
              <MarginRows
                simsPromise={simsPromise}
                q={q}
                page={page}
                actionConfig={actionConfig}
                onDelete={setDeleteTarget}
              />
            </Suspense>
          </TableBody>
        </Table>
      </div>

      <Suspense fallback={null}>
        <MarginPager simsPromise={simsPromise} q={q} page={page} onPageChange={setPage} />
      </Suspense>

      <MarginEntryDialog
        open={open}
        onOpenChange={setOpen}
        productsPromise={productsPromise}
        editing={null}
        actionConfig={actionConfig}
        onDone={() => router.refresh()}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => { if (!next) { setDeleteTarget(null); setDeleteError(null); } }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete simulation</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.productName}{deleteTarget ? ` · ${deleteTarget.packSize} L` : ""}
              </span>
              ? This cannot be undone.
            </p>
            {deleteError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The data-dependent rows — resolves the saved simulations, filters them, and
 *  shows only the current page. Wrapped in <Suspense> by the parent so only this
 *  block shimmers. */
function MarginRows({
  simsPromise,
  q,
  page,
  actionConfig,
  onDelete,
}: {
  readonly simsPromise: Promise<MarginSim[]>;
  readonly q: string;
  readonly page: number;
  readonly actionConfig: ActionConfig;
  readonly onDelete: (r: MarginSim) => void;
}) {
  const initial = use(simsPromise);
  const filtered = filterSims(initial, q);

  if (filtered.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
          {initial.length === 0
            ? "No simulations yet — click “New simulation” to add one."
            : "No simulations match your search."}
        </TableCell>
      </TableRow>
    );
  }

  // Clamp the page so a shrinking result set (search / delete) never lands on an
  // empty page.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <>
      {pageRows.map((r) => (
        <MarginRow key={r.id} row={r} actionConfig={actionConfig} onDelete={onDelete} />
      ))}
    </>
  );
}

/** "Page X of Y" + Prev/Next below the table. Resolves the same promise so it can
 *  count the filtered rows; renders nothing when everything fits on one page. */
function MarginPager({
  simsPromise,
  q,
  page,
  onPageChange,
}: {
  readonly simsPromise: Promise<MarginSim[]>;
  readonly q: string;
  readonly page: number;
  readonly onPageChange: (p: number) => void;
}) {
  const filtered = filterSims(use(simsPromise), q);
  if (filtered.length <= PAGE_SIZE) return null;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount);
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular-nums">
        Page {current} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
