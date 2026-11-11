import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets, TargetValues } from "./targets-api";
import type { TargetsPanelState } from "./use-targets-panel";

import { PasteAllDialog } from "./paste-all-dialog";

const execs = [{ userId: "u1" }, { userId: "u2" }] as ExecutiveTargets[];
const clip: TargetValues = { oil: { Car: 1 }};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (over: any): TargetsPanelState => ({
  confirmAll: true, setConfirmAll: vi.fn(), period: "week", label: "Week of 06 Jul 2026",
  bulkError: null, executives: execs, clipboard: clip,
  applyAll: { isPending: false, mutate: vi.fn() },
  ...over,
}) as TargetsPanelState;

describe("PasteAllDialog", () => {
  it("names the period + count and applies the clipboard to all", () => {
    const p = state({});
    render(<PasteAllDialog p={p} />);
    expect(screen.getByText(/overwrite the/)).toBeInTheDocument();
    expect(screen.getByText("weekly")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply to 2" }));
    expect(p.applyAll.mutate).toHaveBeenCalledWith(clip);
  });

  it("cancel closes; a bulk error is shown", () => {
    const p = state({ bulkError: "Nope" });
    render(<PasteAllDialog p={p} />);
    expect(screen.getByText("Nope")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.setConfirmAll).toHaveBeenCalledWith(false);
  });

  it("dismissing via the dialog (Escape) closes", () => {
    const p = state({});
    render(<PasteAllDialog p={p} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(p.setConfirmAll).toHaveBeenCalledWith(false);
  });

  it("disables Apply while pending and with no clipboard", () => {
    const { rerender } = render(<PasteAllDialog p={state({ applyAll: { isPending: true, mutate: vi.fn() } })} />);
    expect(screen.getByRole("button", { name: "Applying…" })).toBeDisabled();
    rerender(<PasteAllDialog p={state({ clipboard: null })} />);
    expect(screen.getByRole("button", { name: "Apply to 2" })).toBeDisabled();
  });
});
