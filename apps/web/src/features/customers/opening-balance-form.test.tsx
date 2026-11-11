import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hook = {
  asOfDate: "2026-03-31",
  setAsOfDate: vi.fn(),
  amount: "",
  setAmount: vi.fn(),
  remarks: "",
  setRemarks: vi.fn(),
  busy: false,
  error: null as string | null,
  locked: false,
  canClear: false,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
  handleClear: vi.fn(),
};
vi.mock("./use-opening-form", () => ({ useOpeningForm: () => hook }));
vi.mock("./opening-balance-fields", () => ({ OpeningBalanceFields: () => <div>fields</div> }));

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OpeningForm } from "./opening-balance-form";
import type { OpeningBalance } from "./opening-balance-logic";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const ob = { id: "o1", openingAmount: 1000 } as unknown as OpeningBalance;

const renderForm = (initial: OpeningBalance | null, onCancel = vi.fn()) =>
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="sm">
        <OpeningForm customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} initial={initial} onDone={vi.fn()} onCancel={onCancel} />
      </DialogContent>
    </Dialog>,
  );

const resetHook = (over: Partial<typeof hook> = {}) => {
  Object.assign(hook, { busy: false, error: null, locked: false, canClear: false }, over);
  hook.handleSubmit.mockClear();
  hook.handleClear.mockClear();
};

describe("OpeningForm", () => {
  it("submits and shows 'Set opening balance' for a fresh balance", () => {
    resetHook();
    renderForm(null);
    const btn = screen.getByRole("button", { name: "Set opening balance" });
    fireEvent.submit(btn.closest("form")!);
    expect(hook.handleSubmit).toHaveBeenCalled();
  });

  it("shows 'Save changes' when editing and a Clear button when allowed", () => {
    resetHook({ canClear: true });
    renderForm(ob);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(hook.handleClear).toHaveBeenCalled();
  });

  it("hides the submit button and shows an error when locked", () => {
    resetHook({ locked: true, error: "Boom" });
    renderForm(ob);
    expect(screen.queryByRole("button", { name: /Save|Set/ })).not.toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("shows a busy Saving… label while saving", () => {
    resetHook({ busy: true });
    renderForm(null);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("cancels via the Cancel button", () => {
    resetHook();
    const onCancel = vi.fn();
    renderForm(null, onCancel);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
