import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

vi.mock("@dnd-kit/core", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DndContext: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DragOverlay: ({ children }: any) => <div>overlay:{children}</div>,
  PointerSensor: function PointerSensor() {},
  closestCorners: {},
  useSensor: () => ({}),
  useSensors: () => [],
}));
const board = {
  items: { pool: ["p1"], "1": ["a"], "2": [], "3": [], "4": [], "5": [], "6": [] },
  byId: new Map<string, BeatCustomer>(),
  activeId: "a",
  onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn(), onDragCancel: vi.fn(),
};
vi.mock("./use-beat-board", () => ({ useBeatBoard: () => board }));
vi.mock("./beat-pool", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatPool: ({ customers }: any) => <div>pool:{customers.length}</div>,
}));
vi.mock("./beat-column", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatColumn: ({ title, customers }: any) => <div>col:{title}:{customers.length}</div>,
}));
vi.mock("./beat-card", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatCardView: ({ customer }: any) => <span>drag:{customer.legalName}</span>,
}));

import { BeatKanban } from "./beat-kanban";

const cust = (id: string): BeatCustomer => ({
  customerId: id, customerCode: id, legalName: id.toUpperCase(), tradeName: null, phone: null, city: null,
  segment: null, weekday: 1, sequenceNo: 0,
});

describe("BeatKanban", () => {
  it("renders the pool + six weekday columns, resolving ids to customers", () => {
    board.byId = new Map([["a", cust("a")], ["p1", cust("p1")]]);
    render(<BeatKanban customers={[cust("a"), cust("p1")]} disabled={false} callbacks={{ onReorderDay: vi.fn(), onUnassign: vi.fn() }} onAssign={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("pool:1")).toBeInTheDocument();
    expect(screen.getByText("col:Monday:1")).toBeInTheDocument();
    expect(screen.getByText("col:Saturday:0")).toBeInTheDocument();
    // The active card shows in the drag overlay.
    expect(screen.getByText("drag:A")).toBeInTheDocument();
  });

  it("renders no overlay card when nothing is being dragged", () => {
    board.activeId = null as unknown as string;
    render(<BeatKanban customers={[]} disabled={false} callbacks={{ onReorderDay: vi.fn(), onUnassign: vi.fn() }} onAssign={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByText(/^drag:/)).not.toBeInTheDocument();
    board.activeId = "a";
  });
});
