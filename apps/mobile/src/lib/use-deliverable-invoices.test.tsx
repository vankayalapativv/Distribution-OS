import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeliverableInvoices } from "./use-deliverable-invoices";
import type { DeliverableInvoice } from "./deliverable-invoice";

let queryData: { invoices: DeliverableInvoice[] } | undefined;
const apiFetch = vi.fn();
const getLocalDb = vi.fn<() => unknown>(() => null);
const getDeliveryStops = vi.fn<(...a: unknown[]) => { invoiceId: string | null }[]>(() => []);
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({ getDeliveryStops: (...a: unknown[]) => getDeliveryStops(...a) }));
vi.mock("./use-cached-query", () => ({
  useCachedQuery: (cfg: { fetcher: () => unknown }) => {
    cfg.fetcher(); // exercise the inner apiFetch closure
    return { data: queryData };
  },
}));

function inv(id: string, over: Partial<DeliverableInvoice> = {}): DeliverableInvoice {
  return {
    id, invoiceNumber: `INV-${id}`, invoiceDate: "2026-08-05", grandTotal: 100,
    customerId: `c${id}`, customerName: `Cust ${id}`, customerCode: null,
    addressStreet: null, addressCity: null, latitude: null, longitude: null, ...over,
  };
}

beforeEach(() => {
  queryData = { invoices: [inv("1"), inv("2", { customerName: "Balaji" })] };
  apiFetch.mockResolvedValue({ invoices: [] });
  getLocalDb.mockReturnValue(null);
  getDeliveryStops.mockReturnValue([]);
});
afterEach(() => vi.clearAllMocks());

describe("useDeliverableInvoices", () => {
  it("returns all invoices when nothing is filtered, fetching the pending list", () => {
    const { result } = renderHook(() => useDeliverableInvoices("tok", "run-1"));
    expect(result.current.filtered.map((i) => i.id)).toEqual(["1", "2"]);
    expect(apiFetch).toHaveBeenCalledWith("/deliveries/pending-invoices", { token: "tok" });
  });

  it("matches invoices whose customer name is null without throwing", () => {
    queryData = { invoices: [inv("1", { customerName: null })] };
    const { result } = renderHook(() => useDeliverableInvoices("tok", "run-1"));
    act(() => result.current.setSearch("zzz"));
    expect(result.current.filtered).toEqual([]);
  });

  it("filters by invoice number or customer name", () => {
    const { result } = renderHook(() => useDeliverableInvoices("tok", "run-1"));
    act(() => result.current.setSearch("balaji"));
    expect(result.current.filtered.map((i) => i.id)).toEqual(["2"]);
    act(() => result.current.setSearch("INV-1"));
    expect(result.current.filtered.map((i) => i.id)).toEqual(["1"]);
  });

  it("reset hides invoices already delivered locally this run and clears search", () => {
    getLocalDb.mockReturnValue({ id: "db" });
    getDeliveryStops.mockReturnValue([{ invoiceId: "1" }, { invoiceId: null }]);
    const { result } = renderHook(() => useDeliverableInvoices("tok", "run-1"));
    act(() => result.current.setSearch("x"));
    act(() => result.current.reset());
    expect(result.current.search).toBe("");
    expect(result.current.filtered.map((i) => i.id)).toEqual(["2"]); // "1" delivered
  });

  it("reset with no db or run leaves nothing excluded", () => {
    const { result } = renderHook(() => useDeliverableInvoices("tok", undefined));
    act(() => result.current.reset());
    expect(result.current.filtered.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("tolerates an empty query payload", () => {
    queryData = undefined;
    const { result } = renderHook(() => useDeliverableInvoices("tok", "run-1"));
    expect(result.current.filtered).toEqual([]);
  });
});
