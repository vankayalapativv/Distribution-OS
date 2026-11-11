import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paged = { table: {}, total: 3, pageCount: 1, pageSize: 8, showSkeleton: false, error: null };
const usePagedTable = vi.fn();
vi.mock("@/components/data-table/use-paged-table", () => ({
  usePagedTable: (o: unknown) => { usePagedTable(o); return paged; },
}));
const params = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/invoices",
}));
const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));
const openInvoicePdf = vi.fn();
vi.mock("./invoices-api", async () => {
  const actual = await vi.importActual<typeof import("./invoices-api")>("./invoices-api");
  return { ...actual, openInvoicePdf: (...a: unknown[]) => openInvoicePdf(...a) };
});

import { useInvoicesList } from "./use-invoices-list";
import type { InvoiceRow } from "./invoices-api";

const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => { vi.clearAllMocks(); params.forEach((_, k) => params.delete(k)); });
afterEach(() => vi.restoreAllMocks());

describe("useInvoicesList", () => {
  it("applies the trimmed search to the URL and clears it", () => {
    const { result } = renderHook(() => useInvoicesList(config));
    act(() => result.current.setQInput("  BAL/1 "));
    act(() => result.current.applySearch());
    expect(replace).toHaveBeenCalledWith("/invoices?q=BAL%2F1", { scroll: false });
    act(() => result.current.clearSearch());
    expect(replace).toHaveBeenLastCalledWith("/invoices", { scroll: false });
    expect(result.current.qInput).toBe("");
  });

  it("derives the customer filter from the URL and clears it via the URL", () => {
    params.set("customerId", "c1");
    params.set("customerName", "Acme");
    const { result } = renderHook(() => useInvoicesList(config));
    expect(result.current.customerId).toBe("c1");
    expect(result.current.customerName).toBe("Acme");
    expect(usePagedTable.mock.calls.at(-1)![0]).toMatchObject({ filters: { customerId: "c1" } });
    act(() => result.current.clearCustomer());
    expect(replace).toHaveBeenCalledWith("/invoices?customerName=Acme", { scroll: false });
  });

  it("openPdf and invalidate delegate correctly", () => {
    const { result } = renderHook(() => useInvoicesList(config));
    result.current.openPdf({ id: "i9", invoiceNumber: "BAL/9" } as InvoiceRow);
    expect(openInvoicePdf).toHaveBeenCalledWith("i9", "BAL/9");
    result.current.invalidate();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["invoices"] });
  });
});
