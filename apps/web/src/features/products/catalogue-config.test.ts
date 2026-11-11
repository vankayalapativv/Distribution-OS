import { describe, expect, it } from "vitest";
import { CATALOGUE_CATEGORIES, CATALOGUE_META, NOUN } from "./catalogue-config";

describe("catalogue config", () => {
  it("lists the oils category with its singular noun", () => {
    expect(CATALOGUE_CATEGORIES.map((c) => c.value)).toEqual(["oils"]);
    expect(NOUN).toEqual({ oils: "oil" });
  });

  it("wires oils to its paged endpoint + default sort", () => {
    expect(CATALOGUE_META.oils).toEqual({ queryKey: "products", path: "/products/paged", rowsKey: "products", sortId: "productName" });
  });
});
