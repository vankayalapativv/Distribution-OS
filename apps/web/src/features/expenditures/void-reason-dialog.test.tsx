import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { open: boolean; title: string; description: React.ReactNode; confirmLabel: string; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) =>
    p.open ? <div><h1>{p.title}</h1><p>{p.description}</p><span>{p.confirmLabel}</span>{p.extra}<button onClick={() => void p.onConfirm()}>go</button></div> : null,
}));

import { VoidReasonDialog } from "./void-reason-dialog";

const onConfirm = vi.fn(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (open: boolean) =>
  render(<VoidReasonDialog open={open} title="Reverse?" description="desc" onOpenChange={onOpenChange} onConfirm={onConfirm} />);
afterEach(() => vi.clearAllMocks());

describe("VoidReasonDialog", () => {
  it("renders nothing while closed", () => {
    expect(render2(false).container).toBeEmptyDOMElement();
  });

  it("passes a trimmed reason, defaulting to null when blank", () => {
    render2(true);
    expect(screen.getByText("desc")).toBeInTheDocument();
    expect(screen.getByText("Reverse")).toBeInTheDocument(); // default confirmLabel
    fireEvent.click(screen.getByText("go")); // blank → null
    expect(onConfirm).toHaveBeenCalledWith(null);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  wrong month  " } });
    fireEvent.click(screen.getByText("go"));
    expect(onConfirm).toHaveBeenLastCalledWith("wrong month");
  });

  it("clears the reason when reopened", () => {
    const { rerender } = render2(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "note" } });
    rerender(<VoidReasonDialog open={false} title="Reverse?" description="desc" onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    rerender(<VoidReasonDialog open title="Reverse?" description="desc" onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe("");
  });
});
