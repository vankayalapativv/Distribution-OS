import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets } from "./targets-api";

vi.mock("./target-progress", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetProgress: ({ targetOnly }: any) => <div>progress targetOnly={String(targetOnly)}</div>,
}));

import { TargetsExecRow } from "./targets-exec-row";

const exec = (set: boolean): ExecutiveTargets => ({
  userId: "u1", name: "Asha",
  perf: { periodStart: "2026-07-01", oilActual: [], oilTarget: set ? [{ segment: "Car", litres: 5 }] : null},
  currentTarget: null,
});
const handlers = () => ({ onEdit: vi.fn(), onCopy: vi.fn() });

describe("TargetsExecRow", () => {
  it("shows Edit + Copy for a set target and wires them", () => {
    const h = handlers();
    render(<TargetsExecRow exec={exec(true)} canEdit isFuture={false} copied={false} {...h} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit target" }));
    expect(h.onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(h.onCopy).toHaveBeenCalled();
    expect(screen.getByText("progress targetOnly=false")).toBeInTheDocument();
  });

  it("labels the button 'Set upcoming' for a future unset target and hides Copy", () => {
    render(<TargetsExecRow exec={exec(false)} canEdit isFuture={true} copied={false} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Set upcoming" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.getByText("progress targetOnly=true")).toBeInTheDocument();
  });

  it("labels 'Set target' for a current unset target, and hides Edit when read-only", () => {
    const { rerender } = render(<TargetsExecRow exec={exec(false)} canEdit isFuture={false} copied={false} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Set target" })).toBeInTheDocument();
    rerender(<TargetsExecRow exec={exec(true)} canEdit={false} isFuture={false} copied={true} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Edit target" })).not.toBeInTheDocument();
    expect(screen.getByText("Copied ✓")).toBeInTheDocument();
  });
});
