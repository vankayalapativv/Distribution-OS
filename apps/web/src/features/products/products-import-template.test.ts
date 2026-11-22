import { describe, expect, it, vi } from "vitest";

const downloadSheets = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/xlsx-io", () => ({ downloadSheets: (...a: unknown[]) => downloadSheets(...a) }));

import { PRODUCT_COLUMNS, downloadProductsTemplate } from "./products-import-template";

describe("downloadProductsTemplate", () => {
  it("builds a Products sheet (header + examples) and a Reference sheet listing brands", async () => {
    await downloadProductsTemplate(["Fuchs", "Savsol"]);
    expect(downloadSheets).toHaveBeenCalledOnce();
    const [name, sheets] = downloadSheets.mock.calls[0];
    expect(name).toBe("Products-template");
    const [products, reference] = sheets;
    expect(products.name).toBe("Products");
    expect(products.rows[0]).toEqual([...PRODUCT_COLUMNS]);
    // example rows are present and flagged for deletion
    expect(products.rows.some((r: unknown[]) => String(r[0]).includes("delete this row"))).toBe(true);
    expect(reference.name).toBe("Reference");
    const flat = reference.rows.flat();
    expect(flat).toContain("Fuchs");
    expect(flat).toContain("Savsol");
  });
});
