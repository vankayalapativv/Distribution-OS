import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a), errorMessage: (e: unknown, d: string) => (e instanceof Error && e.message ? e.message : d) };
});

import { ApiRequestError } from "@/lib/api-client";
import { saveProduct } from "./product-save";
import type { ManagedProduct, ProductPack } from "./products-api";

const cfg = { apiBaseUrl: "", authToken: "" };
const pack = { packSize: 5 } as unknown as ProductPack;
const values = { name: " Fuchs 10W40 ", brand: " Fuchs ", hsnCode: " 27101980 ", unit: "litres" as const, segments: ["Car"], packs: [pack] };
const target = { id: "p1" } as ManagedProduct;

afterEach(() => vi.clearAllMocks());

describe("saveProduct", () => {
  it("POSTs a trimmed new product", async () => {
    apiRequest.mockResolvedValue({ product: target });
    expect(await saveProduct(cfg, null, values)).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/products", {
      productName: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", unit: "litres", segments: ["Car"], packs: [pack],
    });
  });

  it("PATCHes an edit and drops packs for a quantity product", async () => {
    apiRequest.mockResolvedValue({ product: target });
    await saveProduct(cfg, target, { ...values, unit: "quantity" });
    expect(apiRequest).toHaveBeenCalledWith(cfg, "PATCH", "/products/p1", expect.objectContaining({ unit: "quantity", packs: [] }));
  });

  it("maps a 409/422 to its field", async () => {
    apiRequest.mockRejectedValueOnce(new ApiRequestError("dup", 409));
    expect(await saveProduct(cfg, null, values)).toEqual({ ok: false, field: "name", fieldMessage: "dup" });
    apiRequest.mockRejectedValueOnce(new ApiRequestError("bad segment", 422));
    expect(await saveProduct(cfg, null, values)).toMatchObject({ ok: false, field: "segments" });
  });

  it("returns a create vs update general error for a non-field failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error(""));
    expect(await saveProduct(cfg, null, values)).toEqual({ ok: false, generalError: "Couldn't create the product. Try again." });
    apiRequest.mockRejectedValueOnce(new Error(""));
    expect(await saveProduct(cfg, target, values)).toEqual({ ok: false, generalError: "Couldn't update the product. Try again." });
  });
});
