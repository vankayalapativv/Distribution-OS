import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const apiGet = vi.fn().mockResolvedValue({
  products: [{ id: "p1", productName: "Fuchs 10W40" }, { id: "p2", productName: "  Fuchs 10W40 " }, { id: "p3", productName: "Savsol" }],
});
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { useExistingProductNames } from "./use-existing-product-names";
import type { ManagedProduct } from "./products-api";

const cfg = { apiBaseUrl: "", authToken: "" };
function run(open: boolean, editTarget: ManagedProduct | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useExistingProductNames(open, editTarget, cfg), { wrapper });
}

afterEach(() => vi.clearAllMocks());

describe("useExistingProductNames", () => {
  it("normalises + de-duplicates catalogue names once the query resolves", async () => {
    const { result } = run(true, null);
    await waitFor(() => expect(result.current.size).toBeGreaterThan(0));
    expect([...result.current].sort()).toEqual(["Fuchs 10W40", "Savsol"]);
  });

  it("excludes the product being edited (by normalised name)", async () => {
    const { result } = run(true, { productName: "Fuchs 10W40" } as ManagedProduct);
    await waitFor(() => expect(result.current.size).toBeGreaterThan(0));
    expect(result.current.has("Fuchs 10W40")).toBe(false);
    expect(result.current.has("Savsol")).toBe(true);
  });

  it("is empty while the dialog is closed (query disabled, no data)", () => {
    const { result } = run(false, null);
    expect(result.current.size).toBe(0);
  });
});
