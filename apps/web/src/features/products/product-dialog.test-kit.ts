import { vi } from "vitest";

type SubmitResult = { ok: boolean; field?: string };
type HandleSubmit = (e: { preventDefault: () => void }) => SubmitResult | Promise<SubmitResult>;

// A stand-in for the useProductForm return value, shared by the product-dialog.*
// test files. Each file mocks ./use-product-form to return this object and resets
// it with Object.assign(form, defaults()) in beforeEach. handleSubmit is typed as a
// plain function (not a Mock) so tests can swap in sync or async implementations.
export const defaults = () => ({
  productName: "Fuchs", setProductName: vi.fn(),
  brand: "Fuchs", setBrand: vi.fn(),
  hsnCode: "2710", setHsnCode: vi.fn(),
  unit: "litres" as "litres" | "quantity", setUnit: vi.fn(),
  segments: ["Car"] as string[], toggleSegment: vi.fn(),
  packs: [] as unknown[], setPacks: vi.fn(),
  busy: false, error: null as string | null,
  fieldErrors: {} as Record<string, string>,
  touched: {} as Record<string, boolean>,
  touch: vi.fn(),
  isStepValid: (_s: number) => true,
  allValid: true,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => { e.preventDefault(); return { ok: true }; }) as HandleSubmit,
});

export const config = { apiBaseUrl: "", authToken: "" };
