import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecoveryPlanFields, toRecoveryPlan } from "./recovery-plan-fields";

describe("toRecoveryPlan", () => {
  it("full_next needs no installment", () => {
    expect(toRecoveryPlan("full_next", "", 10000)).toEqual({ recoveryPlan: "full_next", installmentAmount: null });
  });
  it("installment must be > 0 and ≤ amount", () => {
    expect(toRecoveryPlan("installment", "2000", 10000)).toEqual({ recoveryPlan: "installment", installmentAmount: 2000 });
    expect(toRecoveryPlan("installment", "0", 10000)).toBeNull();
    expect(toRecoveryPlan("installment", "20000", 10000)).toBeNull();
  });
});

describe("RecoveryPlanFields", () => {
  it("shows the installment input only for the installment plan", () => {
    const setPlan = vi.fn();
    const setInstallment = vi.fn();
    const { rerender } = render(<RecoveryPlanFields plan="full_next" setPlan={setPlan} installment="" setInstallment={setInstallment} />);
    expect(screen.queryByLabelText(/Installment/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Recover from salary"), { target: { value: "installment" } });
    expect(setPlan).toHaveBeenCalledWith("installment");
    rerender(<RecoveryPlanFields plan="installment" setPlan={setPlan} installment="2000" setInstallment={setInstallment} />);
    const inst = screen.getByLabelText(/Installment/);
    fireEvent.change(inst, { target: { value: "3000" } });
    expect(setInstallment).toHaveBeenCalledWith("3000");
  });
});
