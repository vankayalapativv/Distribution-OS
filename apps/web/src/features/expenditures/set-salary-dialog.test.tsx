import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { title: string; confirmLabel: string; confirmDisabled: boolean; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) => (
    <div><h1>{p.title}</h1><span>disabled:{String(p.confirmDisabled)}</span>{p.extra}<button onClick={() => void p.onConfirm()}>{p.confirmLabel}</button></div>
  ),
}));

import { SetSalaryDialog } from "./set-salary-dialog";

const staff = [{ id: "u1", name: "Priya", role: "SALES_EXECUTIVE" }];
const onSave = vi.fn(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (open: boolean) => render(<SetSalaryDialog open={open} staff={staff} onOpenChange={onOpenChange} onSave={onSave} />);
afterEach(() => vi.clearAllMocks());

describe("SetSalaryDialog", () => {
  it("renders nothing when closed", () => {
    expect(render2(false).container).toBeEmptyDOMElement();
  });

  it("is disabled until person + amount, then saves", () => {
    render2(true);
    expect(screen.getByText("disabled:true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save salary")); // invalid → no-op
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText("Monthly salary (₹)"), { target: { value: "20000" } });
    expect(screen.getByText("disabled:false")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save salary"));
    expect(onSave).toHaveBeenCalledWith("u1", 20000, null);
  });

  it("resets when reopened", () => {
    const { rerender } = render2(true);
    fireEvent.change(screen.getByLabelText("Monthly salary (₹)"), { target: { value: "99" } });
    rerender(<SetSalaryDialog open={false} staff={staff} onOpenChange={onOpenChange} onSave={onSave} />);
    rerender(<SetSalaryDialog open staff={staff} onOpenChange={onOpenChange} onSave={onSave} />);
    expect((screen.getByLabelText("Monthly salary (₹)") as HTMLInputElement).value).toBe("");
  });
});
