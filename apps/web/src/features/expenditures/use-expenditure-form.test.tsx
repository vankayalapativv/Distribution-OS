import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import type { Expenditure } from "./expenditures-api";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));

import { useExpenditureForm } from "./use-expenditure-form";

const editing: Expenditure = {
  id: "e1", expenditureCode: "EXP-1", expenditureDate: "2026-07-10", categoryId: "c1", categoryName: "Rent",
  type: "compulsory", amount: 5000, paymentMode: "upi", paidTo: "Landlord", userId: "u1", userName: "Asha",
  remarks: "July rent", hasBill: true, createdAt: "",
};
const config = { apiBaseUrl: "https://api.test", authToken: "tok" };
const onOpenChange = vi.fn();
const submit = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

beforeEach(() => { vi.clearAllMocks(); apiRequest.mockResolvedValue({ id: "new1" }); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("useExpenditureForm", () => {
  it("seeds today's date for a new entry, and the target for an edit", () => {
    const create = renderHook(() => useExpenditureForm(config, true, null, onOpenChange));
    expect(create.result.current.form.expenditureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(create.result.current.form.categoryId).toBe("");
    const edit = renderHook(() => useExpenditureForm(config, true, editing, onOpenChange));
    expect(edit.result.current.form).toMatchObject({ categoryId: "c1", amount: "5000", paidTo: "Landlord", userId: "u1" });
  });

  it("requires date + category + positive amount to submit", () => {
    const { result } = renderHook(() => useExpenditureForm(config, true, null, onOpenChange));
    expect(result.current.canSubmit).toBe(false);
    act(() => { result.current.set("categoryId", "c1"); result.current.set("amount", "10"); });
    expect(result.current.canSubmit).toBe(true);
  });

  it("POSTs a new entry with only the filled optional fields, then closes", async () => {
    const { result } = renderHook(() => useExpenditureForm(config, true, null, onOpenChange));
    act(() => { result.current.set("categoryId", "c1"); result.current.set("amount", "250"); result.current.set("paidTo", " Vendor "); });
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/expenditures", expect.objectContaining({ categoryId: "c1", amount: 250, paidTo: "Vendor" }));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expenditures"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("PATCHes an edit and uploads a bill when one is picked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useExpenditureForm(config, true, editing, onOpenChange));
    act(() => result.current.setBill(new File(["x"], "bill.pdf")));
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "PATCH", "/expenditures/e1", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/expenditures/new1/bill", expect.objectContaining({ method: "POST" }));
  });

  it("surfaces an error when the bill upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => useExpenditureForm(config, true, null, onOpenChange));
    act(() => { result.current.set("categoryId", "c1"); result.current.set("amount", "5"); result.current.setBill(new File(["x"], "b.png")); });
    await act(async () => result.current.handleSubmit(submit()));
    await waitFor(() => expect(result.current.error).toMatch(/bill upload failed/));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
