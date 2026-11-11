import { describe, expect, it } from "vitest";
import {
  ALLOWED_SEGMENTS,
  bulkCreateProducts,
  createProduct,
  deleteProduct,
  listManagedProducts,
  listManagedProductsPaged,
  normalizeProductName,
  updateProduct,
  validateHsn,
} from "./products";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "admin-1" };

const PRODUCT_ROW = {
  id: "p1",
  productName: "Titan GT1",
  brand: "Fuchs",
  hsnCode: "27101980",
  unit: "litres",
  segments: ["Car", "2W"],
  packs: [
    { packSize: 5, stockItemId: "s1", stockQty: "12" },
    { packSize: 1, stockItemId: null, stockQty: null },
  ],
  status: "active",
  createdAt: "2026-06-01",
};

describe("validateHsn / normalizeProductName / ALLOWED_SEGMENTS", () => {
  it("accepts an 8-digit HSN and rejects anything else", () => {
    expect(validateHsn(" 27101980 ")).toBe("27101980");
    expect(() => validateHsn("2710")).toThrowError(/exactly 8 digits/);
  });
  it("collapses NBSP + whitespace and trims", () => {
    expect(normalizeProductName("  Titan  GT1   10W-30 ")).toBe("Titan GT1 10W-30");
  });
  it("exposes the canonical segment set", () => {
    expect(ALLOWED_SEGMENTS).toContain("Coolant");
  });
});

describe("listManagedProducts", () => {
  it("maps rows (segments, size-only packs + stock)", async () => {
    const sql = makeSql({ list_managed_products: [PRODUCT_ROW] });
    const [p] = await listManagedProducts(sql, CTX);
    expect(p).toMatchObject({ id: "p1", unit: "litres", segments: ["Car", "2W"] });
    expect(p.packs[0]).toMatchObject({ packSize: 5, stockItemId: "s1", stockQty: 12 });
    expect(p.packs[1]).toMatchObject({ packSize: 1, stockItemId: null, stockQty: null });
  });
});

describe("listManagedProductsPaged", () => {
  it("applies search/status/brand filters, paginates, and returns total", async () => {
    const sql = makeSql({
      list_managed_products_paged_count: [{ total: 1 }],
      list_managed_products_paged: [PRODUCT_ROW],
    });
    const res = await listManagedProductsPaged(sql, CTX, { search: "titan", status: "active", brand: "Fuchs", page: 1, pageSize: 20 });
    expect(res).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(res.rows[0].id).toBe("p1");
    const countCall = sql.calls.find((c) => c.tag === "list_managed_products_paged_count")!;
    expect(countCall.params).toContain("active");
    expect(countCall.params).toContain("Fuchs");
  });

  it("defaults total to 0 with no filters", async () => {
    const sql = makeSql({ list_managed_products_paged_count: [], list_managed_products_paged: [] });
    expect((await listManagedProductsPaged(sql, CTX, {})).total).toBe(0);
  });
});

const baseInput = () => ({
  productName: "Titan GT1",
  brand: "Fuchs",
  segments: ["Car", "2W"],
  packs: [{ packSize: 5 }],
  hsnCode: "27101980",
  unit: "litres",
});

describe("createProduct", () => {
  it("validates name, segments and HSN (422)", async () => {
    await expect(createProduct(makeSql(), CTX, { ...baseInput(), productName: "   " })).rejects.toMatchObject({ status: 422 });
    await expect(createProduct(makeSql({ upsert_brand: [] }), CTX, { ...baseInput(), segments: [] })).rejects.toMatchObject({ status: 422 });
    await expect(createProduct(makeSql({ upsert_brand: [] }), CTX, { ...baseInput(), segments: ["Spaceship"] })).rejects.toMatchObject({ status: 422 });
    await expect(createProduct(makeSql({ upsert_brand: [] }), CTX, { ...baseInput(), hsnCode: "123" })).rejects.toMatchObject({ status: 422 });
  });

  it("409s a duplicate name", async () => {
    const sql = makeSql({ upsert_brand: [], "": [{ id: "dup" }] });
    await expect(createProduct(sql, CTX, baseInput())).rejects.toMatchObject({ status: 409 });
  });

  it("inserts the product + segments + packs and returns it", async () => {
    const sql = makeSql({ upsert_brand: [], "": [], create_product: [{ id: "p1" }], select_product_by_id: [PRODUCT_ROW] });
    const res = await createProduct(sql, CTX, baseInput());
    expect(res).toMatchObject({ id: "p1", productName: "Titan GT1" });
    expect(calledTag(sql, "create_product")).toBe(true);
  });

  it("ignores packs for a quantity-unit product and falls back when the re-read misses", async () => {
    const sql = makeSql({ upsert_brand: [], "": [], create_product: [{ id: "p1" }], select_product_by_id: [] });
    const res = await createProduct(sql, CTX, { ...baseInput(), unit: "quantity", packs: [] });
    expect(res).toMatchObject({ productName: "Titan GT1", status: "active" }); // fallback mapping
  });
});

describe("updateProduct", () => {
  const existsSql = (over: Record<string, unknown> = {}) =>
    makeSql({
      upsert_brand: [],
      "": ({ text }) => {
        if (/id <>/.test(text)) return []; // dup-check → none
        if (/select id from products where id =/.test(text)) return [{ id: "p1" }]; // exists
        return [];
      },
      select_product_by_id: [PRODUCT_ROW],
      ...over,
    });

  it("updates name/segments/packs and returns the fresh product", async () => {
    const sql = existsSql();
    const res = await updateProduct(sql, CTX, "p1", baseInput());
    expect(res).toMatchObject({ id: "p1" });
    expect(calledTag(sql, "upsert_brand")).toBe(true);
  });

  it("rejects a blank name (422)", async () => {
    await expect(updateProduct(makeSql(), CTX, "p1", { ...baseInput(), productName: "  " })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the product does not exist", async () => {
    const sql = makeSql({ upsert_brand: [], "": [] }); // exists check → none
    await expect(updateProduct(sql, CTX, "x", baseInput())).rejects.toMatchObject({ status: 404 });
  });

  it("409s when the new name clashes with another product", async () => {
    const sql = makeSql({
      upsert_brand: [],
      "": ({ text }) => {
        if (/id <>/.test(text)) return [{ id: "other" }]; // dup exists
        if (/select id from products where id =/.test(text)) return [{ id: "p1" }];
        return [];
      },
    });
    await expect(updateProduct(sql, CTX, "p1", baseInput())).rejects.toMatchObject({ status: 409 });
  });
});

describe("deleteProduct", () => {
  it("deletes a product and returns its id + name", async () => {
    const sql = makeSql({ "": [{ id: "p1", productName: "Titan GT1" }] });
    expect(await deleteProduct(sql, CTX, "p1")).toEqual({ id: "p1", productName: "Titan GT1" });
  });

  it("404s a missing product", async () => {
    await expect(deleteProduct(makeSql({ "": [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("409s when the product is referenced by orders (FK)", async () => {
    const sql = makeSql({
      "": ({ text }) => {
        if (/delete from products/.test(text)) throw new Error("foreign key violation");
        return [{ id: "p1", productName: "Titan GT1" }];
      },
    });
    await expect(deleteProduct(sql, CTX, "p1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("bulkCreateProducts", () => {
  const litres = (name: string, over: Record<string, unknown> = {}) => ({
    productName: name, brand: "Fuchs", segments: ["Car"], hsnCode: "27101980", unit: "litres",
    packs: [{ packSize: 5 }], ...over,
  });

  it("rejects an empty or non-array payload", async () => {
    await expect(bulkCreateProducts(makeSql(), CTX, [])).rejects.toMatchObject({ status: 422 });
    await expect(bulkCreateProducts(makeSql(), CTX, "nope")).rejects.toMatchObject({ status: 422 });
  });

  it("inserts valid rows (litres + quantity) in one batch", async () => {
    const sql = makeSql({ bulk_products_existing_names: [] });
    const res = await bulkCreateProducts(sql, CTX, [
      litres("New Oil A"),
      { productName: "New Grease B", brand: "Savsol", segments: ["Grease"], hsnCode: "27101980", unit: "quantity", packs: [] },
    ]);
    expect(res).toEqual({ created: 2, errors: [] });
    for (const t of ["bulk_upsert_brands", "bulk_insert_products", "bulk_insert_segments", "bulk_insert_packs"]) {
      expect(calledTag(sql, t)).toBe(true);
    }
  });

  it("collects per-row validation errors while inserting the valid rows", async () => {
    const sql = makeSql({ bulk_products_existing_names: [] });
    const res = await bulkCreateProducts(sql, CTX, [
      litres("   "),                               // 1: no name
      litres("Valid One"),                         // 2: ok
      litres("No Brand", { brand: "  " }),          // 3: no brand
      litres("Bad Seg", { segments: ["Spaceship"] }), // 4: bad segment
      litres("Bad Hsn", { hsnCode: "123" }),        // 5: bad HSN
      litres("Valid One"),                          // 6: repeated in file
    ]);
    expect(res.created).toBe(1);
    expect(res.errors.map((e) => e.row)).toEqual([1, 3, 4, 5, 6]);
  });

  it("flags catalogue duplicates and still inserts the rest", async () => {
    const sql = makeSql({ bulk_products_existing_names: [{ product_name: "Existing Oil" }] });
    const res = await bulkCreateProducts(sql, CTX, [litres("Existing Oil"), litres("Brand New")]);
    expect(res.created).toBe(1);
    expect(res.errors).toEqual([{ row: 1, message: '"Existing Oil" already exists in the catalogue.' }]);
  });

  it("returns created:0 and runs no insert when every row is a catalogue duplicate", async () => {
    const sql = makeSql({ bulk_products_existing_names: [{ product_name: "Existing Oil" }] });
    const res = await bulkCreateProducts(sql, CTX, [litres("Existing Oil")]);
    expect(res).toEqual({ created: 0, errors: [{ row: 1, message: '"Existing Oil" already exists in the catalogue.' }] });
    expect(calledTag(sql, "bulk_insert_products")).toBe(false);
  });
});
