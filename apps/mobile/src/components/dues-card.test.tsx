import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchDuesSummary = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/dues", () => ({ fetchDuesSummary: () => fetchDuesSummary() }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DuesCard } from "./dues-card";
import type { DuesSummary } from "../lib/dues";

const band = (key: string, label: string, customers: number, outstanding: number) => ({
  key,
  label,
  fromDays: 0,
  toDays: null,
  customers,
  outstanding,
});

const SUMMARY: DuesSummary = {
  bands: [],
  buckets: [band("0_30", "0–30d", 2, 8000), band("60_plus", "61+d", 1, 3000)],
  totalCustomers: 3,
  totalOutstanding: 11000,
};

beforeEach(() => fetchDuesSummary.mockReset());

describe("DuesCard", () => {
  it("shows outstanding total + bands once loaded", async () => {
    fetchDuesSummary.mockResolvedValue(SUMMARY);
    render(<DuesCard />);
    expect(await screen.findByText("Collection dues")).toBeInTheDocument();
    expect(screen.getByText("₹11,000")).toBeInTheDocument();
    expect(screen.getByText(/3 customers/)).toBeInTheDocument();
    expect(screen.getByText("0–30d")).toBeInTheDocument();
  });

  it("uses singular wording for a single customer", async () => {
    fetchDuesSummary.mockResolvedValue({ ...SUMMARY, totalCustomers: 1 });
    render(<DuesCard />);
    expect(await screen.findByText(/1 customer$/)).toBeInTheDocument();
  });

  it("shows the empty state when no customer has dues", async () => {
    fetchDuesSummary.mockResolvedValue({ ...SUMMARY, buckets: [], totalCustomers: 0, totalOutstanding: 0 });
    render(<DuesCard />);
    expect(await screen.findByText(/No customers with outstanding dues/)).toBeInTheDocument();
  });

  it("hides the card when the first fetch returns nothing", async () => {
    fetchDuesSummary.mockResolvedValue(null);
    const { container } = render(<DuesCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("reports completion to the refresh coordinator on refreshSignal", async () => {
    fetchDuesSummary.mockResolvedValue(SUMMARY);
    const onSettled = vi.fn();
    const { rerender } = render(<DuesCard refreshSignal={0} onSettled={onSettled} />);
    await screen.findByText("₹11,000");
    // Pull returns updated figures → the card re-renders with them.
    fetchDuesSummary.mockResolvedValue({ ...SUMMARY, totalOutstanding: 22000 });
    rerender(<DuesCard refreshSignal={1} onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(await screen.findByText("₹22,000")).toBeInTheDocument();
  });

  it("keeps prior data on a null pull-refresh with no onSettled handler", async () => {
    fetchDuesSummary.mockResolvedValue(SUMMARY);
    const { rerender } = render(<DuesCard refreshSignal={0} />);
    await screen.findByText("₹11,000");
    fetchDuesSummary.mockResolvedValue(null); // failed pull → prior figures stay
    rerender(<DuesCard refreshSignal={1} />);
    await waitFor(() => expect(screen.getByText("₹11,000")).toBeInTheDocument());
  });
});
