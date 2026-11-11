import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLedgerDialogState } from "./use-ledger-dialog-state";
import type { LedgerRow } from "./ledger-types";

const row = (over: Partial<LedgerRow>): LedgerRow =>
  ({ date: "", type: "Sale", vchNo: null, particulars: "", narration: "", debit: null, credit: null, balance: 0, ...over }) as LedgerRow;

describe("useLedgerDialogState", () => {
  it("dispatches onEdit to the matching edit id by row type", () => {
    const { result } = renderHook(() => useLedgerDialogState());

    act(() => result.current.onEdit(row({ type: "Rcpt", collectionId: "c1" })));
    expect(result.current.editCollectionId).toBe("c1");

    act(() => result.current.onEdit(row({ type: "Sale_re", returnId: "r1" })));
    expect(result.current.editReturnId).toBe("r1");
  });

  it("toggles the create dialogs open", () => {
    const { result } = renderHook(() => useLedgerDialogState());
    act(() => result.current.setReturnOpen(true));
    expect(result.current.returnOpen).toBe(true);
    act(() => result.current.setCreditNoteOpen(true));
    expect(result.current.creditNoteOpen).toBe(true);
    act(() => result.current.setOpeningOpen(true));
    expect(result.current.openingOpen).toBe(true);
  });
});
