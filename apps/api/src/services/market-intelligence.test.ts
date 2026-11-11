import { describe, expect, it } from "vitest";
import { updateMarketNote } from "./market-intelligence";
import { makeSql } from "../test/sql-mock";

const NOTE_ROW = {
  id: "n1", meetingDate: "2026-06-01", seUserId: "se-1", seName: "Asha",
  customerId: "c1", customerName: "Ravi", note: "met", createdBy: "u1",
  createdByName: "Admin", createdAt: "2026-06-01T00:00:00Z",
};

describe("updateMarketNote", () => {
  it("updates the note and re-lists its items when items aren't replaced", async () => {
    const sql = makeSql({
      update_market_note: [NOTE_ROW],
      list_market_note_items: [{ id: "it1", noteId: "n1", category: "pricing", competitorBrand: "X", product: "oil", price: "100", details: null }],
    });
    const out = await updateMarketNote(sql, "n1", { meetingDate: null, seUserId: null, customerId: null, note: "edit", items: null });
    expect(out).toMatchObject({ id: "n1" });
    expect(out.items).toHaveLength(1);
  });

  it("404s when the note does not exist", async () => {
    const sql = makeSql({ update_market_note: [] });
    await expect(updateMarketNote(sql, "x", { meetingDate: null, seUserId: null, customerId: null, note: null, items: null })).rejects.toMatchObject({ status: 404 });
  });
});
