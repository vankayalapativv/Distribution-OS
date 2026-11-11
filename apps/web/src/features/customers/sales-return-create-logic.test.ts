import { describe, expect, it } from "vitest";
import { createReturnFormData, todayIso } from "./sales-return-create-logic";

describe("todayIso", () => {
  it("returns a yyyy-MM-dd string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("createReturnFormData", () => {
  const items = [{ orderItemId: "a", quantityUnits: 2 }];

  it("includes the core fields and JSON items", () => {
    const fd = createReturnFormData({ customerId: "c1", invoiceId: "inv1", date: "2026-07-01", items, reason: "", proofFile: null });
    expect(fd.get("customerId")).toBe("c1");
    expect(fd.get("invoiceId")).toBe("inv1");
    expect(fd.get("returnDate")).toBe("2026-07-01");
    expect(JSON.parse(fd.get("items") as string)).toEqual(items);
    expect(fd.get("reason")).toBeNull(); // blank reason omitted
    expect(fd.get("file")).toBeNull();
  });

  it("appends a trimmed reason and the proof file when present", () => {
    const file = new File(["x"], "p.png");
    const fd = createReturnFormData({ customerId: "c1", invoiceId: "inv1", date: "d", items, reason: "  damaged  ", proofFile: file });
    expect(fd.get("reason")).toBe("damaged");
    expect(fd.get("file")).toBe(file);
  });
});
