"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";

/**
 * ⋮ header menu with "Copy ledger link" — mints (once) the customer's permanent
 * public-statement token and copies `${origin}/statement/<token>` to the
 * clipboard. Shown for all three back-office roles. The link is public and
 * un-revocable by design, so the menu says so plainly.
 */
function copyStatusLabel(busy: boolean, copied: boolean): string {
  if (busy) return "…";
  if (copied) return "Copied ✓";
  return "";
}

export function CustomerStatementLinkMenu({
  customerId,
  actionConfig,
}: {
  readonly customerId: string;
  readonly actionConfig: ActionConfig;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await apiRequest<{ token: string }>(
        actionConfig,
        "POST",
        `/customers/${customerId}/statement-token`,
      );
      const link = `${window.location.origin}/statement/${token}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Clipboard blocked (older webview) — leave the link visible to copy by hand.
        setError("Couldn't copy automatically — select the link below.");
      }
    } catch (e) {
      setError(errorMessage(e, "Couldn't generate the link. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="More actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-lg leading-none text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        ⋮
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="border-b border-border px-3.5 py-3">
          <p className="text-[13px] font-semibold text-foreground">Public account statement</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Anyone with this link can view this customer&apos;s live ledger and outstanding. The link is
            permanent and cannot be revoked.
          </p>
        </div>

        <div className="p-2.5">
          <button
            type="button"
            onClick={copyLink}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[13px] font-medium text-foreground hover:bg-accent disabled:opacity-60"
          >
            <span>Copy ledger link</span>
            <span className="text-[12px] text-muted-foreground">
              {copyStatusLabel(busy, copied)}
            </span>
          </button>

          {url ? (
            <p className="mt-2 select-all break-all rounded-md bg-muted/40 px-2.5 py-2 font-mono text-[11.5px] text-muted-foreground">
              {url}
            </p>
          ) : null}
          {error ? <p className="mt-2 px-1 text-[12px] text-red-600">{error}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
