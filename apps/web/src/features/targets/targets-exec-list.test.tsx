import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets } from "./targets-api";
import type { TargetsPanelState } from "./use-targets-panel";

vi.mock("./targets-exec-row", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetsExecRow: ({ exec, onEdit }: any) => (
    <div>row:{exec.name}<button onClick={onEdit}>edit-{exec.userId}</button></div>
  ),
}));
vi.mock("./targets-exec-skeleton", () => ({ TargetsExecSkeleton: () => <div>SKELETON</div> }));

import { TargetsExecList } from "./targets-exec-list";

const exec = { userId: "u1", name: "Asha" } as unknown as ExecutiveTargets;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (over: any): TargetsPanelState => ({
  isPast: false, isFuture: false, canEdit: true,
  setEditing: vi.fn(), executives: [exec],
  query: { isLoading: false, isError: false, refetch: vi.fn() },
  ...over,
}) as TargetsPanelState;

describe("TargetsExecList", () => {
  it("renders the context-aware skeleton while loading", () => {
    render(<TargetsExecList p={state({ query: { isLoading: true } })} />);
    expect(screen.getByText("SKELETON")).toBeInTheDocument();
  });

  it("shows an error with a retry that refetches", () => {
    const refetch = vi.fn();
    render(<TargetsExecList p={state({ query: { isLoading: false, isError: true, refetch } })} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("distinguishes an empty past period from an empty current one", () => {
    const { rerender } = render(<TargetsExecList p={state({ executives: [], isPast: true })} />);
    expect(screen.getByText("No targets were set for this period.")).toBeInTheDocument();
    rerender(<TargetsExecList p={state({ executives: [] })} />);
    expect(screen.getByText("No active sales executives.")).toBeInTheDocument();
  });

  it("renders a row per exec and wires edit", () => {
    const p = state({});
    render(<TargetsExecList p={p} />);
    fireEvent.click(screen.getByText("edit-u1"));
    expect(p.setEditing).toHaveBeenCalledWith(exec);
  });
});
