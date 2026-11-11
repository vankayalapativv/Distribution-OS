import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DayMeta } from "./attendance-grid-table";
import type { AttendanceGridRow as Row } from "./attendance-api";

vi.mock("./attendance-grid-row", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AttendanceGridRow: ({ row }: any) => (
    <tr><td>{row.name}</td></tr>
  ),
}));

import { AttendanceGridTable } from "./attendance-grid-table";

const dayMeta: DayMeta[] = [
  { d: "2026-07-01", day: 1, initial: "W", sunday: false },
  { d: "2026-07-05", day: 5, initial: "S", sunday: true },
];
const rows: Row[] = [{ userId: "u1", name: "Asha", days: [] }];
const base = { dayMeta, today: "2026-07-05", canEdit: false, onEdit: vi.fn() };

describe("AttendanceGridTable", () => {
  it("renders the day-number header and a row per SE", () => {
    render(<AttendanceGridTable {...base} rows={rows} isLoading={false} />);
    expect(screen.getByText("Sales Executive")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
  });

  it("shows 6 skeleton rows while loading (no data rows)", () => {
    const { container } = render(<AttendanceGridTable {...base} rows={[]} isLoading={true} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(6);
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
  });

  it("shows the empty message when there are no SEs", () => {
    render(<AttendanceGridTable {...base} rows={[]} isLoading={false} />);
    expect(screen.getByText("No active sales executives.")).toBeInTheDocument();
  });
});
