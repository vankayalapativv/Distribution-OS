import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { clearDraft, readDraft, useFormDraft } from "./use-form-draft";

afterEach(() => {
  localStorage.clear();
});

interface Form {
  amount: string;
  remark: string;
}
const EMPTY: Form = { amount: "", remark: "" };
const isEmpty = (f: Form) => !f.amount && !f.remark;

describe("form-draft helpers — #5 never-drop-writes", () => {
  it("round-trips a draft through localStorage under a namespaced key", () => {
    expect(readDraft<Form>("k")).toBeNull();
    localStorage.setItem("distribution-os:draft:k", JSON.stringify({ amount: "500", remark: "hi" }));
    expect(readDraft<Form>("k")).toEqual({ amount: "500", remark: "hi" });
    clearDraft("k");
    expect(readDraft<Form>("k")).toBeNull();
  });

  it("returns null (never throws) on corrupt JSON", () => {
    localStorage.setItem("distribution-os:draft:bad", "{not json");
    expect(readDraft<Form>("bad")).toBeNull();
  });

  it("persists a dirty form (debounced) and restores it", async () => {
    const { rerender } = renderHook(
      ({ value }) => useFormDraft({ key: "c", value, enabled: true, isEmpty }),
      { initialProps: { value: EMPTY } },
    );
    // Nothing saved while empty.
    expect(readDraft<Form>("c")).toBeNull();

    rerender({ value: { amount: "1200", remark: "cash" } });
    // Poll past the 400ms debounce (waitFor flushes effects between polls).
    await waitFor(() => expect(readDraft<Form>("c")).toEqual({ amount: "1200", remark: "cash" }));
  });

  it("keeps the draft when the form closes (enabled → false)", async () => {
    const { rerender } = renderHook(
      ({ value, enabled }) => useFormDraft({ key: "d", value, enabled, isEmpty }),
      { initialProps: { value: { amount: "9", remark: "" }, enabled: true } },
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    expect(readDraft<Form>("d")).toEqual({ amount: "9", remark: "" });

    // Closing must NOT wipe the saved draft — it's the survive-a-reload safety net.
    await act(async () => {
      rerender({ value: { amount: "9", remark: "" }, enabled: false });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(readDraft<Form>("d")).toEqual({ amount: "9", remark: "" });
  });

  it("drops a stale draft once the open form is emptied", async () => {
    localStorage.setItem("distribution-os:draft:e", JSON.stringify({ amount: "5", remark: "" }));
    renderHook(() => useFormDraft({ key: "e", value: EMPTY, enabled: true, isEmpty }));
    // Open + empty → the effect clears the stale entry synchronously.
    expect(readDraft<Form>("e")).toBeNull();
  });

  it("clear() wipes the draft (used on a successful submit)", async () => {
    const { result } = renderHook(() =>
      useFormDraft({ key: "f", value: { amount: "1", remark: "" }, enabled: true, isEmpty }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    expect(readDraft<Form>("f")).not.toBeNull();
    act(() => result.current.clear());
    expect(readDraft<Form>("f")).toBeNull();
  });
});
