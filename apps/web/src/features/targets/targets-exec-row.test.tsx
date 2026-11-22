import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets } from "./targets-api";

vi.mock("./target-progress", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetProgress: ({ targetOnly }: any) => <div>progress targetOnly={String(targetOnly)}</div>,
}));

import { TargetsExecRow } from "./targets-exec-row";

const exec = (set: boolean, inherited = false): ExecutiveTargets => ({
  userId: "u1", name: "Asha",
  perf: { periodStart: "2026-07-01", oilActual: [], oilTarget: set ? [{ segment: "Car", litres: 5 }] : null, oilTargetInherited: inherited },
  currentTarget: null,
});

describe("TargetsExecRow", () => {
  it("shows the Edit button for a set target and wires it (no Copy control)", () => {
    const onEdit = vi.fn();
    render(<TargetsExecRow exec={exec(true)} canEdit isFuture={false} onEdit={onEdit} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit target" }));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.getByText("progress targetOnly=false")).toBeInTheDocument();
  });

  it("labels the button 'Set upcoming' for a future unset target", () => {
    render(<TargetsExecRow exec={exec(false)} canEdit isFuture={true} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set upcoming" })).toBeInTheDocument();
    expect(screen.getByText("progress targetOnly=true")).toBeInTheDocument();
  });

  it("shows an 'Inherited' chip for a carried-forward target, and not for an explicit one", () => {
    const { rerender } = render(<TargetsExecRow exec={exec(true, true)} canEdit isFuture={false} onEdit={vi.fn()} />);
    expect(screen.getByText("Inherited")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit target" })).toBeInTheDocument(); // still editable → sets an explicit target
    rerender(<TargetsExecRow exec={exec(true, false)} canEdit isFuture={false} onEdit={vi.fn()} />);
    expect(screen.queryByText("Inherited")).not.toBeInTheDocument();
  });

  it("labels 'Set target' for a current unset target, and hides Edit when read-only", () => {
    const { rerender } = render(<TargetsExecRow exec={exec(false)} canEdit isFuture={false} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Set target" })).toBeInTheDocument();
    rerender(<TargetsExecRow exec={exec(true)} canEdit={false} isFuture={false} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit target" })).not.toBeInTheDocument();
  });
});
