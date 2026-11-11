"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { fetchCompanyProfile } from "@/lib/company";
import { downloadLedgerPdf } from "./customer-ledger-pdf";
import { presetRange, type LedgerPreset } from "./customer-ledger-range";
import type { LedgerData } from "./ledger-types";

/** Fetch a receipt/invoice/return file as a blob URL (auth header). */
async function fetchBlobUrl(actionConfig: ActionConfig, path: string): Promise<{ url: string; type: string } | null> {
  const res = await fetch(`${actionConfig.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${actionConfig.authToken}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

/** All the ledger tab's data + state: the date range, the ledger query, proof
 *  viewing, and the PDF download. */
export function useLedgerView(customerId: string, customerName: string, actionConfig: ActionConfig) {
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [preset, setPreset] = useState<LedgerPreset>("this-month");
  const [calOpen, setCalOpen] = useState(false);
  const [proof, setProof] = useState<{ url: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const onPreset = (p: Exclude<LedgerPreset, "custom">) => {
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
    setPreset(p);
  };
  const onCalendar = (sel: DateRange | undefined) => {
    if (!sel?.from) return;
    const f = format(sel.from, "yyyy-MM-dd");
    setFrom(f);
    setTo(sel.to ? format(sel.to, "yyyy-MM-dd") : f);
    setPreset("custom");
  };

  const query = useQuery({
    queryKey: ["customer-ledger", customerId, from, to],
    queryFn: () => apiGet<LedgerData>(actionConfig, `/customers/${customerId}/ledger?from=${from}&to=${to}`),
    refetchOnWindowFocus: false,
  });
  const data = query.data;
  const showSkeleton = query.isLoading || query.isFetching;
  const empty = !showSkeleton && !!data && data.rows.length === 0;

  const openInvoice = async (invoiceId: string) => {
    const r = await fetchBlobUrl(actionConfig, `/invoice-files/${invoiceId}`);
    if (r) window.open(r.url, "_blank");
  };
  const openProof = async (collectionId: string) => {
    const r = await fetchBlobUrl(actionConfig, `/collections/${collectionId}/proof`);
    if (!r) return;
    if (r.type === "application/pdf") window.open(r.url, "_blank", "noopener");
    else setProof({ url: r.url });
  };
  const openReturnProof = async (returnId: string) => {
    const r = await fetchBlobUrl(actionConfig, `/sales-returns/${returnId}/proof`);
    if (r) setProof({ url: r.url });
  };
  const downloadPdf = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      const company = await fetchCompanyProfile(actionConfig);
      await downloadLedgerPdf(customerName, data, company);
    } finally {
      setDownloading(false);
    }
  };

  return {
    from, to, preset, calOpen, setCalOpen, onPreset, onCalendar,
    query, data, showSkeleton, empty,
    proof, setProof, downloading,
    openInvoice, openProof, openReturnProof, downloadPdf,
  };
}
