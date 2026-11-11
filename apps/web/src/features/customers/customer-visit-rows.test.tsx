import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: (p: { href: string; children: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}));

import { MissedBeatRow, VisitTableRow, WhenCell } from "./customer-visit-rows";
import type { MissedRow, VisitRow } from "./customer-visits-logic";

const wrap = (ui: React.ReactNode) => render(<table><tbody>{ui}</tbody></table>);
const visit = (over: Partial<VisitRow> = {}): VisitRow => ({
  id: "v1",
  visitDate: "2026-07-01",
  checkInTime: "2026-07-01T10:00:00",
  checkOutTime: null,
  durationMinutes: null,
  noOutcomeReason: null,
  executiveName: "Ravi",
  executiveRole: "SALES_EXECUTIVE",
  type: "planned",
  orders: [],
  collections: [],
  marketIntelCount: 0,
  ...over,
});

describe("WhenCell", () => {
  it("shows the date and a time when present", () => {
    render(<WhenCell iso="2026-07-01T14:30:00" date={null} />);
    expect(screen.getByText("2:30 PM")).toBeInTheDocument();
  });
  it("omits the time for a date-only value", () => {
    render(<WhenCell iso={null} date="2026-07-01" />);
    expect(screen.queryByText(/PM|AM/)).not.toBeInTheDocument();
  });
});

describe("MissedBeatRow", () => {
  it("renders a Missed badge", () => {
    wrap(<MissedBeatRow row={{ date: "2026-07-01", at: null, executiveName: "Ravi", newer: 0 } as MissedRow} />);
    expect(screen.getByText("Missed")).toBeInTheDocument();
  });
});

describe("VisitTableRow", () => {
  it("shows an em dash when there is no outcome and the planned type", () => {
    wrap(<VisitTableRow row={visit()} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("planned")).toBeInTheDocument();
  });

  it("shows the time-spent duration and the check-in → check-out range", () => {
    wrap(<VisitTableRow row={visit({ checkOutTime: "2026-07-01T10:24:00", durationMinutes: 24 })} />);
    expect(screen.getByText("24 min")).toBeInTheDocument();
    expect(screen.getByText("10:00 AM → 10:24 AM")).toBeInTheDocument();
  });

  it("shows the no-outcome reason in amber when no order or collection", () => {
    wrap(<VisitTableRow row={visit({ noOutcomeReason: "Owner away" })} />);
    expect(screen.getByText("Owner away")).toBeInTheDocument();
  });

  it("links orders, collections and market intel when present", () => {
    wrap(
      <VisitTableRow
        row={visit({ type: "unplanned", durationMinutes: 15, orders: [{ id: "o1", code: "ORD-1" }], collections: [{ id: "c1", code: "COL-1" }], marketIntelCount: 3 })}
      />,
    );
    expect(screen.getByRole("link", { name: "ORD-1" })).toHaveAttribute("href", "/orders/o1");
    expect(screen.getByRole("link", { name: "COL-1" })).toHaveAttribute("href", "/collections/c1");
    expect(screen.getByRole("link", { name: /Market intel · 3/ })).toHaveAttribute("href", "/market-intelligence");
    expect(screen.getByText("unplanned")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
