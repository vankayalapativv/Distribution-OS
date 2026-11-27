import { describe, expect, it, vi } from "vitest";

// The admin customers screen simply re-exports the (tabs) customers default.
vi.mock("../(tabs)/customers", () => ({ default: () => null }));

import AdminCustomers from "./customers";

describe("admin customers re-export", () => {
  it("re-exports the shared customers screen", () => {
    expect(AdminCustomers).toBeTypeOf("function");
  });
});
