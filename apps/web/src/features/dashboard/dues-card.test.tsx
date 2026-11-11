import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const summaryState = {
  isPending: false,
  isError: false,
  error: null as unknown,
  data: {
    buckets: [{ key: "0_30", label: "0–30d", customers: 2, outstanding: 1000 }],
    totalOutstanding: 1000,
    totalCustomers: 2,
  } as { buckets: { key: string; label: string; customers: number; outstanding: number }[]; totalOutstanding: number; totalCustomers: number } | undefined,
};
const open = vi.fn();
const close = vi.fn();
// Drill-down state is mutable so a test can open a bucket (which mounts the now
// lazily-loaded dialog). The hook lives in its own module (./use-dues-drilldown)
// — mocked here so the real one's useRouter() doesn't run in jsdom.
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
vi.mock("@/features/orders/search-select", () => ({
  // Exercise every arrow the card passes in: getKey/getLabel over the items + onSelect.
  SearchSelect: <T,>(p: {
    items: T[];
    getKey: (x: T) => string;
    getLabel: (x: T) => string;
    onSelect: (v: string) => void;
  }) => (
    <button onClick={() => p.onSelect("e1")} data-count={p.items.map(p.getKey).length}>
      {p.items.map(p.getLabel)[0]}
    </button>
  ),
}));

import { DuesCard } from "./dues-card";

const cfg = { apiBaseUrl: "x", authToken: "t" };
afterEach(() => {
  summaryState.isPending = false;
  summaryState.isError = false;
  summaryState.error = null;
  summaryState.data = { buckets: [{ key: "0_30", label: "0–30d", customers: 2, outstanding: 1000 }], totalOutstanding: 1000, totalCustomers: 2 };
  drillState.bucket = null;
  open.mockClear();
  close.mockClear();
});

describe("DuesCard", () => {
  it("renders the bucket cross and total when data is loaded", () => {
    render(<DuesCard actionConfig={cfg} />);
    expect(screen.getByText("0–30d")).toBeInTheDocument();
    expect(screen.getByText("Total dues")).toBeInTheDocument();
  });

  it("shimmers only the numbers while pending — labels stay constant", () => {
    summaryState.isPending = true;
    const { container } = render(<DuesCard actionConfig={cfg} />);
    // Shimmers are present (the amount + count)…
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    // …but the fixed labels stay put (they never change with the filter)…
    expect(screen.getByText("Total dues")).toBeInTheDocument();
    // …and the actual numbers are hidden behind the shimmers.
    expect(screen.queryByText("2 owe")).not.toBeInTheDocument();
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

  it("wires the executive and city filters", () => {
    render(<DuesCard actionConfig={cfg} />);
    fireEvent.click(screen.getByText("All executives")); // → setExecutiveId + reset city
    fireEvent.click(screen.getByText("All cities")); // → setCity
    expect(screen.getByText("Collection Dues")).toBeInTheDocument();
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
