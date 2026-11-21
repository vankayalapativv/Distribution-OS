import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fullData = {
  buckets: [{ key: "0_30", label: "0–30d", customers: 2, outstanding: 1000 }],
  totalOutstanding: 1000,
  totalCustomers: 2,
};
const summaryState = { isPending: false, isError: false, error: null as unknown, data: fullData as typeof fullData | undefined };
const open = vi.fn();
const close = vi.fn();
// Mutable drill-down state so a test can open a bucket (mounts the lazy dialog).
const drillState = { bucket: null as string | null, rows: null, error: null, open, close };

vi.mock("./use-dues-data", () => ({
  useDuesData: () => ({ cities: ["Guntur"], salesExecutives: [{ id: "e1", name: "Ravi" }], summary: summaryState }),
}));
vi.mock("./use-dues-drilldown", () => ({
  useDuesDrilldown: () => drillState,
}));
vi.mock("./dues-drilldown", () => ({
  DuesDrilldownDialog: (p: { onOpenChange: (o: boolean) => void }) => (
    <>
      <button onClick={() => p.onOpenChange(false)}>close-dues</button>
      <button onClick={() => p.onOpenChange(true)}>open-dues</button>
    </>
  ),
}));
// DuesFilters is tested on its own (dues-card-filters.test); here the stub just
// surfaces the card's onExec/onCity callbacks so those arrows get exercised.
vi.mock("./dues-card-filters", () => ({
  DuesFilters: (p: { onExec: (v: string) => void; onCity: (v: string) => void }) => (
    <div>
      <button onClick={() => p.onExec("e1")}>pick-exec</button>
      <button onClick={() => p.onCity("Guntur")}>pick-city</button>
    </div>
  ),
}));

import { DuesCard } from "./dues-card";

const cfg = { apiBaseUrl: "x", authToken: "t" };
afterEach(() => {
  summaryState.isPending = false;
  summaryState.isError = false;
  summaryState.error = null;
  summaryState.data = fullData;
  drillState.bucket = null;
  open.mockClear();
  close.mockClear();
});

describe("DuesCard", () => {
  it("renders the bucket cross + total, and forwards exec/city picks", () => {
    render(<DuesCard actionConfig={cfg} />);
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    expect(screen.getByText("Total dues")).toBeInTheDocument();
    fireEvent.click(screen.getByText("pick-exec")); // onExec → setExecutiveId + setCity("")
    fireEvent.click(screen.getByText("pick-city")); // onCity → setCity
  });

  it("shimmers only the numbers while pending — labels stay constant", () => {
    summaryState.isPending = true;
    const { container } = render(<DuesCard actionConfig={cfg} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy(); // shimmers present
    expect(screen.getByText("Total dues")).toBeInTheDocument(); // fixed labels stay
    expect(screen.queryByText("2 owe")).not.toBeInTheDocument(); // numbers hidden
  });

  it("shows an error when the summary fails", () => {
    summaryState.isError = true;
    summaryState.data = undefined;
    summaryState.error = new Error("down");
    render(<DuesCard actionConfig={cfg} />);
    expect(screen.getByText("down")).toBeInTheDocument();
  });

  it("shows the fallback error when there is no data and no error", () => {
    summaryState.isError = false;
    summaryState.error = null;
    summaryState.data = undefined;
    render(<DuesCard actionConfig={cfg} />);
    expect(screen.getByText("Could not load collection dues.")).toBeInTheDocument();
  });

  it("closes the drilldown on dialog close", async () => {
    drillState.bucket = "0_30"; // open a bucket so the lazy dialog mounts
    render(<DuesCard actionConfig={cfg} />);
    fireEvent.click(await screen.findByText("close-dues")); // await the lazy chunk
    expect(close).toHaveBeenCalled();
  });

  it("keeps the drilldown open when the dialog is opening", async () => {
    drillState.bucket = "0_30";
    render(<DuesCard actionConfig={cfg} />);
    fireEvent.click(await screen.findByText("open-dues"));
    expect(close).not.toHaveBeenCalled();
  });
});
