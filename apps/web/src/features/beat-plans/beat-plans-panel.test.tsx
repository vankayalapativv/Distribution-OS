import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

const state = {
  executiveId: "u1", selectExecutive: vi.fn(), executives: [{ id: "u1", name: "Asha" }],
  customers: [{ customerId: "c1", legalName: "Acme" }] as unknown as BeatCustomer[],
  isError: false, switching: false,
  reorderMut: { mutate: vi.fn() }, removeMut: { mutate: vi.fn() }, assignMut: { mutate: vi.fn(), isPending: false },
};
vi.mock("./use-beat-plans", () => ({ useBeatPlans: () => state }));
vi.mock("@/components/data-table/query-provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withQueryClient: (C: any) => C,
}));
vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, getKey, getLabel, onSelect }: any) => (
    <button onClick={() => onSelect(getKey(items[0]))}>exec:{getLabel(items[0])}</button>
  ),
}));
vi.mock("./beat-stats", () => ({ BeatStats: () => <div>STATS</div> }));
vi.mock("./beat-board-skeleton", () => ({ BeatBoardSkeleton: () => <div>SKELETON</div> }));
vi.mock("./beat-kanban", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatKanban: ({ callbacks, onAssign, onRemove }: any) => (
    <div>KANBAN
      <button onClick={() => callbacks.onReorderDay(2, ["c1"])}>reorder</button>
      <button onClick={() => callbacks.onUnassign("c1")}>unassign</button>
      <button onClick={() => onAssign("c1", 3)}>assign</button>
      <button onClick={() => onRemove("c1")}>remove</button>
    </div>
  ),
}));

import { BeatPlansPanel } from "./beat-plans-panel";

const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => { state.isError = false; state.switching = false; });

describe("BeatPlansPanel", () => {
  it("renders stats + kanban and wires all four board actions", () => {
    render(<BeatPlansPanel actionConfig={config} />);
    expect(screen.getByText("STATS")).toBeInTheDocument();
    expect(screen.getByText("KANBAN")).toBeInTheDocument();
    fireEvent.click(screen.getByText("exec:Asha")); // getLabel/getKey resolve the exec
    expect(state.selectExecutive).toHaveBeenCalledWith("u1");
    fireEvent.click(screen.getByText("reorder"));
    expect(state.reorderMut.mutate).toHaveBeenCalledWith({ weekday: 2, customerIds: ["c1"] });
    fireEvent.click(screen.getByText("unassign"));
    expect(state.removeMut.mutate).toHaveBeenCalledWith("c1");
    fireEvent.click(screen.getByText("assign"));
    expect(state.assignMut.mutate).toHaveBeenCalledWith({ customerId: "c1", weekday: 3 });
    fireEvent.click(screen.getByText("remove"));
    expect(state.removeMut.mutate).toHaveBeenCalledWith("c1");
  });

  it("shows the skeleton while switching and an error message on failure", () => {
    state.switching = true;
    const { rerender } = render(<BeatPlansPanel actionConfig={config} />);
    expect(screen.getByText("SKELETON")).toBeInTheDocument();
    state.switching = false;
    state.isError = true;
    rerender(<BeatPlansPanel actionConfig={config} />);
    expect(screen.getByText(/Couldn't load this beat plan/)).toBeInTheDocument();
  });
});
