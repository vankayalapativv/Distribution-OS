import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets } from "./targets-api";

const form = {
  segments: { Car: "20" } as Record<string, string>, setSegment: vi.fn(),
  error: null as string | null,
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
const base = { actionConfig: config, executive: exec, period: "week" as const, periodStart: "2026-07-06", onClose: vi.fn() };

describe("TargetEditDialog", () => {
  it("titles with name + period and wires segment/save", () => {
    render(<TargetEditDialog {...base} />);
    expect(screen.getByText(/Asha — weekly target/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("segs"));
    expect(form.setSegment).toHaveBeenCalledWith("Car", "9");
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    expect(form.save.mutate).toHaveBeenCalled();
  });

  it("has no Copy / Paste / Copy-from-current controls", () => {
    render(<TargetEditDialog {...base} />);
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paste" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Copy from current/)).not.toBeInTheDocument();
  });

  it("Cancel and Escape both close", () => {
    const onClose = vi.fn();
    render(<TargetEditDialog {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
