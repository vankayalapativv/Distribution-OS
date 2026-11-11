import { afterEach, describe, expect, it, vi } from "vitest";

const { assertCustomerVisible } = vi.hoisted(() => ({
  assertCustomerVisible: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./customers", () => ({ assertCustomerVisible }));

import {
  createCustomerNote,
  deleteCustomerNote,
  listCustomerNotes,
  updateCustomerNote,
} from "./customer-notes";
import { makeSql } from "../test/sql-mock";

const CUST = "11111111-2222-4333-8444-555555555555";
const CTX = { userId: "u1", role: "MANAGER" as const };
const CREATED = new Date("2026-06-01T10:00:00Z");

afterEach(() => vi.clearAllMocks());

describe("listCustomerNotes", () => {
  it("scopes by customer visibility and maps rows (edited flag + ISO dates)", async () => {
    const sql = makeSql({
      list_customer_notes: [
        { id: "n1", body: "unedited", createdAt: CREATED, authorName: "Asha", editedAt: null, editorName: null },
        { id: "n2", body: "edited", createdAt: CREATED, authorName: null, editedAt: CREATED, editorName: "Sri" },
      ],
    });
    const notes = await listCustomerNotes(sql, CTX, CUST);
    expect(assertCustomerVisible).toHaveBeenCalledWith(sql, CTX, CUST);
    expect(notes[0]).toMatchObject({ id: "n1", edited: false, authorName: "Asha", editedAt: null });
    expect(notes[1]).toMatchObject({ id: "n2", edited: true, authorName: "Unknown", editorName: "Sri" });
    expect(notes[1].editedAt).toBe(CREATED.toISOString());
  });

  it("propagates a visibility rejection (foreign customer)", async () => {
    assertCustomerVisible.mockRejectedValueOnce(Object.assign(new Error("nope"), { status: 404 }));
    await expect(listCustomerNotes(makeSql(), CTX, CUST)).rejects.toMatchObject({ status: 404 });
  });
});

describe("createCustomerNote", () => {
  it("inserts and returns the new note (not yet edited)", async () => {
    const sql = makeSql({
      create_customer_note: [
        { id: "n9", body: "hi", createdAt: CREATED, authorName: "Asha", editedAt: null, editorName: null },
      ],
    });
    const note = await createCustomerNote(sql, CTX, CUST, "hi");
    expect(note).toMatchObject({ id: "n9", body: "hi", edited: false, authorName: "Asha" });
  });
});

describe("updateCustomerNote", () => {
  it("returns the edited note on success", async () => {
    const sql = makeSql({
      update_customer_note: [
        { id: "n1", body: "new", createdAt: CREATED, authorName: "Asha", editedAt: CREATED, editorName: "Sri" },
      ],
    });
    const note = await updateCustomerNote(sql, CUST, "n1", "new", "editor1");
    expect(note).toMatchObject({ id: "n1", body: "new", edited: true, editorName: "Sri" });
  });

  it("throws 404 when the note does not exist", async () => {
    const sql = makeSql({ update_customer_note: [] });
    await expect(updateCustomerNote(sql, CUST, "nope", "x", "e")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("deleteCustomerNote", () => {
  it("resolves when a row was deleted", async () => {
    const sql = makeSql({ delete_customer_note: [{ id: "n1" }] });
    await expect(deleteCustomerNote(sql, CUST, "n1")).resolves.toBeUndefined();
  });

  it("throws 404 when nothing was deleted", async () => {
    const sql = makeSql({ delete_customer_note: [] });
    await expect(deleteCustomerNote(sql, CUST, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
