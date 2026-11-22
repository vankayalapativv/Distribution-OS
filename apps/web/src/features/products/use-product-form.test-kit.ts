import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { FormEvent } from "react";
import type { ManagedProduct, ProductPack } from "./products-api";
import { useProductForm } from "./use-product-form";

// Shared fixtures + hook harness for the use-product-form.* test files. The two
// react-query / api-client mocks stay in each test file (vi.mock is per-file).
export const config = { apiBaseUrl: "", authToken: "" };
export const onOpenChange = vi.fn();
export const pack = { packSizeMl: 1000, mrp: 100, mop: 90 } as unknown as ProductPack;
export const valid = { name: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", unit: "litres" as const, segments: ["Car"], packs: [pack] };
export const target = {
  id: "p1", productName: "Old", brand: "Shell", hsnCode: "38201000", unit: "litres", segments: ["2W"], packs: [pack],
} as unknown as ManagedProduct;

export const setup = (open = true, edit: ManagedProduct | null = null) =>
  renderHook(({ o, e }) => useProductForm(o, e, onOpenChange, config), { initialProps: { o: open, e: edit } });
export const submit = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
