import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets, TargetValues } from "./targets-api";

const form = {
  segments: { Car: "20" } as Record<string, string>, setSegment: vi.fn(),
  error: null as string | null, copied: false,
  copyable: { oil: []} as ExecutiveTargets["currentTarget"],
  copyFromCurrent: vi.fn(), handleCopy: vi.fn(), fillFrom: vi.fn(),
  save: { isPending: false, mutate: vi.fn() },
};
vi.mock("./use-target-form", () => ({ useTargetForm: () => form }));
vi.mock("./target-segment-inputs", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetSegmentInputs: ({ onChange }: any) => <button onClick={() => onChange("Car", "9")}>segs</button>,
}));

import { TargetEditDialog } from "./target-edit-dialog";

const exec = { userId: "u1", name: "Asha" } as unknown as ExecutiveTargets;
const config = { apiBaseUrl: "", authToken: "" };
const base = { actionConfig: config, executive: exec, period: "week" as const, periodStart: "2026-07-06", onCopy: vi.fn(), onClose: vi.fn() };
const clip: TargetValues = { oil: { Car: 1 }};

describe("TargetEditDialog", () => {
  it("titles with name + period and wires segment/save", () => {
    render(<TargetEditDialog {...base} isFuture={false} clipboard={null} />);
    expect(screen.getByText(/Asha — weekly target/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("segs"));
    expect(form.setSegment).toHaveBeenCalledWith("Car", "9");
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    expect(form.save.mutate).toHaveBeenCalled();
  });

  it("Copy/Paste use the clipboard; Paste is disabled without one", () => {
    const { rerender } = render(<TargetEditDialog {...base} isFuture={false} clipboard={null} />);
    expect(screen.getByRole("button", { name: "Paste" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(form.handleCopy).toHaveBeenCalled();
    rerender(<TargetEditDialog {...base} isFuture={false} clipboard={clip} />);
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    expect(form.fillFrom).toHaveBeenCalledWith(clip);
  });

  it("shows 'Copy from current' only for a future period with a copyable target", () => {
    const { rerender } = render(<TargetEditDialog {...base} isFuture={false} clipboard={null} />);
    expect(screen.queryByText(/Copy from current/)).not.toBeInTheDocument();
    rerender(<TargetEditDialog {...base} isFuture={true} clipboard={null} />);
    fireEvent.click(screen.getByText(/Copy from current/));
    expect(form.copyFromCurrent).toHaveBeenCalled();
  });

  it("Cancel and Escape both close", () => {
    const onClose = vi.fn();
    render(<TargetEditDialog {...base} onClose={onClose} isFuture={false} clipboard={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
