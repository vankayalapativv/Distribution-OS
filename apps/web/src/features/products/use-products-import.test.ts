import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (e: unknown, d: string) => (e instanceof Error ? e.message : d),
}));
const readSheetRows = vi.fn();
vi.mock("@/lib/xlsx-io", () => ({ readSheetRows: (...a: unknown[]) => readSheetRows(...a) }));
const parseProductsRows = vi.fn();
vi.mock("./products-import", () => ({ parseProductsRows: (...a: unknown[]) => parseProductsRows(...a) }));

import { useProductsImport } from "./use-products-import";

const cfg = { apiBaseUrl: "", authToken: "" };
const prod = (over = {}) => ({ productName: "P", brand: "Fuchs", hsnCode: "27101980", unit: "litres", segments: ["Car"], packs: [{ packSize: 5 }], ...over });
const review = [
  { product: prod(), error: null as string | null },
  { product: prod({ productName: "Q", packs: [] }), error: "Add at least one pack size." },
  { product: prod({ productName: "R", unit: "quantity", packs: [] }), error: null },
];

afterEach(() => vi.clearAllMocks());

async function withRows(onClose = vi.fn()) {
  parseProductsRows.mockReturnValue(review);
  readSheetRows.mockResolvedValue([{ "Product Name": "P" }]);
  const h = renderHook(() => useProductsImport(cfg, onClose));
  await act(async () => { await h.result.current.onFile(new File(["x"], "p.xlsx")); });
  return h;
}

describe("useProductsImport", () => {
  it("parses a file into review rows and derives ready/errors/pack totals", async () => {
    const { result } = await withRows();
    expect(result.current.fileName).toBe("p.xlsx");
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.ready).toHaveLength(2);      // the two error-free rows
    expect(result.current.errCount).toBe(1);
    expect(result.current.totalPacks).toBe(1);         // only the litres row's one pack
    expect(result.current.parsing).toBe(false);
  });

  it("surfaces a read error and clears rows", async () => {
    readSheetRows.mockRejectedValue(new Error("bad file"));
    const { result } = renderHook(() => useProductsImport(cfg, vi.fn()));
    await act(async () => { await result.current.onFile(new File(["x"], "p.xlsx")); });
    expect(result.current.error).toBe("bad file");
    expect(result.current.rows).toEqual([]);
  });

  it("imports the error-free rows, folds server errors back in, and invalidates", async () => {
    apiRequest.mockResolvedValue({ created: 1, errors: [{ row: 1, message: "first" }, { row: 2, message: "dup name" }] });
    const { result } = await withRows();
    await act(async () => { await result.current.confirm(); });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/products/bulk", { products: [expect.any(Object), expect.any(Object)] });
    expect(result.current.done).toBe("Imported 1 product. 2 rows skipped."); // plural "rows"
    // server errors map onto the ready rows by 1-based index
    expect(result.current.ready[0].serverError).toBe("first");
    expect(result.current.ready[1].serverError).toBe("dup name");
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));
  });

  it("uses singular 'row' for a single skipped row", async () => {
    apiRequest.mockResolvedValue({ created: 3, errors: [{ row: 1, message: "x" }] });
    const { result } = await withRows();
    await act(async () => { await result.current.confirm(); });
    expect(result.current.done).toBe("Imported 3 products. 1 row skipped.");
  });

  it("pluralises cleanly and skips invalidation when nothing was created", async () => {
    apiRequest.mockResolvedValue({ created: 0, errors: [] });
    const { result } = await withRows();
    await act(async () => { await result.current.confirm(); });
    expect(result.current.done).toBe("Imported 0 products.");
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("surfaces an import failure", async () => {
    apiRequest.mockRejectedValue(new Error("server down"));
    const { result } = await withRows();
    await act(async () => { await result.current.confirm(); });
    expect(result.current.error).toBe("server down");
    expect(result.current.busy).toBe(false);
  });

  it("close() resets state and calls onClose", async () => {
    const onClose = vi.fn();
    const { result } = await withRows(onClose);
    act(() => result.current.close());
    expect(onClose).toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
    expect(result.current.fileName).toBe("");
  });
});
