"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import type { ActionConfig } from "@/lib/api-client";
import {
  ORDER_EXPORT_STATUSES,
  downloadOrdersExcel,
  downloadOrdersPdf,
  type OrdersExportFilters,
} from "./orders-export";

/** The page's active filters the export should carry (all optional). */
export type OrdersDownloadFilters = Omit<OrdersExportFilters, "fulfillment">;

/** "Download" button beside New Order — pick a fulfillment status, then export the
 *  matching orders (one row per order, SKUs comma-joined) as PDF or Excel. The
 *  export also carries the page's current search / city / SE / date filters, and
 *  the status defaults to whatever fulfillment filter the page already has. */
export function OrdersDownload({
  actionConfig,
  filters,
  defaultFulfillment,
}: {
  readonly actionConfig: ActionConfig;
  readonly filters: OrdersDownloadFilters;
  readonly defaultFulfillment?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(defaultFulfillment || "all");
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "pdf" | "excel") {
    setBusy(kind);
    setError(null);
    try {
      const args: OrdersExportFilters = { ...filters, fulfillment: status };
      if (kind === "pdf") await downloadOrdersPdf(actionConfig, args);
      else await downloadOrdersExcel(actionConfig, args);
      setOpen(false);
    } catch {
      setError("Download failed — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setStatus(defaultFulfillment || "all");
        else setError(null);
      }}
    >
      <PopoverTrigger className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm font-medium transition-colors hover:bg-accent focus:outline-none">
        <Download size={15} /> Download
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Fulfillment status</Label>
            <SearchSelect
              items={ORDER_EXPORT_STATUSES}
              valueKey={status}
              getKey={(s) => s.value}
              getLabel={(s) => s.label}
              onSelect={(v) => v && setStatus(v)}
              placeholder="Select status"
              searchPlaceholder="Search…"
              emptyText="No match"
              contentClassName="w-[232px] p-0"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => run("pdf")}>
              {busy === "pdf" ? "Exporting…" : "PDF"}
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => run("excel")}>
              {busy === "excel" ? "Exporting…" : "Excel"}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
