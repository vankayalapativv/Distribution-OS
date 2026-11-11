import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({ from: "2026-07-01", to: "2026-07-31", openingBalance: 0, rows: [], totals: { debit: 0, credit: 0, closingBalance: 0 } }));
const downloadLedgerPdf = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("./customer-ledger-pdf", () => ({ downloadLedgerPdf: (...a: unknown[]) => downloadLedgerPdf(...a) }));

import { useLedgerView } from "./use-ledger-view";

const cfg = { apiBaseUrl: "http://api", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const setup = () =>
  renderHook(() => useLedgerView("c1", "Raj", cfg), {
    wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

const fetchOk = (type: string) => ({ ok: true, blob: async () => ({ type }) });

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  window.open = vi.fn();
});
afterEach(() => {
  apiGet.mockClear();
  downloadLedgerPdf.mockClear();
  vi.unstubAllGlobals();
});

describe("useLedgerView", () => {
  it("loads the ledger and computes the empty flag", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.empty).toBe(true);
    expect(apiGet).toHaveBeenCalledWith(cfg, "/customers/c1/ledger?from=" + result.current.from + "&to=" + result.current.to);
  });

  it("applies a preset and a completed / same-day / empty calendar range", () => {
    const { result } = setup();
    act(() => result.current.onPreset("all"));
    expect(result.current.preset).toBe("all");

    act(() => result.current.onCalendar({ from: new Date("2026-06-01"), to: new Date("2026-06-10") }));
    expect(result.current.from).toBe("2026-06-01");
    expect(result.current.to).toBe("2026-06-10");
    expect(result.current.preset).toBe("custom");

    act(() => result.current.onCalendar({ from: new Date("2026-05-05"), to: undefined }));
    expect(result.current.to).toBe("2026-05-05"); // same-day fallback

    const before = result.current.from;
    act(() => result.current.onCalendar(undefined)); // no from → no-op
    expect(result.current.from).toBe(before);
  });

  it("opens an invoice in a new tab", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchOk("application/pdf")));
    const { result } = setup();
    await act(async () => {
      await result.current.openInvoice("inv1");
    });
    expect(window.open).toHaveBeenCalledWith("blob:x", "_blank");
  });

  it("opens a PDF proof in a tab but an image proof in the dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchOk("application/pdf")));
    const pdf = setup();
    await act(async () => {
      await pdf.result.current.openProof("col1");
    });
    expect(window.open).toHaveBeenCalledWith("blob:x", "_blank", "noopener");

    vi.stubGlobal("fetch", vi.fn(async () => fetchOk("image/jpeg")));
    const img = setup();
    await act(async () => {
      await img.result.current.openProof("col2");
    });
    expect(img.result.current.proof).toEqual({ url: "blob:x" });
  });

  it("shows a return proof and ignores failed fetches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchOk("image/png")));
    const ok = setup();
    await act(async () => {
      await ok.result.current.openReturnProof("r1");
    });
    expect(ok.result.current.proof).toEqual({ url: "blob:x" });

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const fail = setup();
    await act(async () => {
      await fail.result.current.openProof("colX");
      await fail.result.current.openInvoice("invX");
      await fail.result.current.openReturnProof("rX");
    });
    expect(fail.result.current.proof).toBeNull();
  });

  it("skips the download when there is no data yet", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = setup(); // query still resolving on first tick
    await act(async () => {
      await result.current.downloadPdf();
    });
    expect(downloadLedgerPdf).not.toHaveBeenCalled();
  });

  it("downloads the PDF once data is present", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    await act(async () => {
      await result.current.downloadPdf();
    });
    expect(downloadLedgerPdf).toHaveBeenCalledWith("Raj", expect.any(Object), expect.any(Object));
  });
});
