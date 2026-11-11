import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMPTY_COMPANY } from "@/lib/company";
import { downloadCustomersPdf } from "./customers-list-pdf";
import type { Customer } from "./customers-api";

const origCreate = globalThis.URL.createObjectURL;
const origRevoke = globalThis.URL.revokeObjectURL;
beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterAll(() => {
  globalThis.URL.createObjectURL = origCreate;
  globalThis.URL.revokeObjectURL = origRevoke;
  vi.restoreAllMocks();
});

const rows = [
  { id: "c1", customerCode: "C-1", legalName: "Ravi Motors", customerType: "mechanic", segment: "Cars", addressCity: "Guntur", salesExecutiveName: "Ravi", status: "active", collectionDues: 500, hasBusiness: true, oldestUnpaidDays: 40 } as unknown as Customer,
];

describe("downloadCustomersPdf", () => {
  it("builds and saves a real customer-list PDF end to end", async () => {
    await expect(downloadCustomersPdf(rows, "Active", EMPTY_COMPANY)).resolves.toBeUndefined();
  });
});
