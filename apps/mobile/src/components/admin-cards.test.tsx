import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminDuesSummary = vi.fn<(...a: unknown[]) => Promise<unknown>>();
const fetchDuesByExecutive = vi.fn<(...a: unknown[]) => Promise<unknown>>();
const fetchFulfillmentSummary = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/admin-dues", () => ({
  fetchAdminDuesSummary: (...a: unknown[]) => fetchAdminDuesSummary(...a),
  fetchDuesByExecutive: (...a: unknown[]) => fetchDuesByExecutive(...a),
}));
vi.mock("../lib/admin-fulfillment", () => ({
  fetchFulfillmentSummary: (...a: unknown[]) => fetchFulfillmentSummary(...a),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { router } from "expo-router";
import { AdminDuesCard } from "./admin-dues-card";
import { AdminSeDuesCard } from "./admin-se-dues-card";
import { AdminFulfillmentCard } from "./admin-fulfillment-card";

const duesSummary = {
  bands: [],
  buckets: [{ key: "b1", label: "0–30d", fromDays: 0, toDays: null, customers: 2, outstanding: 8000 }],
  totalCustomers: 2,
  totalOutstanding: 8000,
};

const fulfillment = {
  ordered: 5, partiallyInvoiced: 0, invoiced: 3, partiallyDelivered: 0,
  delivered: 10, partiallyReturned: 0, returned: 0, cancelled: 1,
};

beforeEach(() => {
  fetchAdminDuesSummary.mockReset();
  fetchDuesByExecutive.mockReset();
  fetchFulfillmentSummary.mockReset();
  (router.push as ReturnType<typeof vi.fn>).mockClear?.();
});

describe("AdminDuesCard", () => {
  it("renders the chrome immediately then the loaded totals", async () => {
    fetchAdminDuesSummary.mockResolvedValue(duesSummary);
    render(<AdminDuesCard />);
    expect(screen.getByText("Collection dues")).toBeInTheDocument(); // chrome up front
    expect(await screen.findByText("₹8,000")).toBeInTheDocument();
  });

  it("hides when the fetch fails with nothing to show", async () => {
    fetchAdminDuesSummary.mockRejectedValue(new Error("down"));
    const { container } = render(<AdminDuesCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("re-fetches on refreshSignal", async () => {
    fetchAdminDuesSummary.mockResolvedValue(duesSummary);
    const { rerender } = render(<AdminDuesCard refreshSignal={0} />);
    await screen.findByText("₹8,000");
    fetchAdminDuesSummary.mockResolvedValue({ ...duesSummary, totalOutstanding: 9999 });
    rerender(<AdminDuesCard refreshSignal={1} />);
    expect(await screen.findByText("₹9,999")).toBeInTheDocument();
  });

  it("deep-links on a bucket tap and opens the dues screen on a card tap", async () => {
    fetchAdminDuesSummary.mockResolvedValue(duesSummary);
    render(<AdminDuesCard />);
    await screen.findByText("₹8,000");
    fireEvent.click(screen.getByText("0–30d"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/(admin)/dues", params: { bucket: "b1" } });
    fireEvent.click(screen.getByText("Tap to view all ›"));
    expect(router.push).toHaveBeenCalledWith("/(admin)/dues");
  });

  it("hides when a pull-refresh fails", async () => {
    fetchAdminDuesSummary.mockResolvedValue(duesSummary);
    const { rerender, container } = render(<AdminDuesCard refreshSignal={0} />);
    await screen.findByText("₹8,000");
    fetchAdminDuesSummary.mockRejectedValue(new Error("down"));
    rerender(<AdminDuesCard refreshSignal={1} />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });
});

describe("AdminSeDuesCard", () => {
  it("renders ranked SE rows", async () => {
    fetchDuesByExecutive.mockResolvedValue([
      { executiveId: "e1", executiveName: "Asha", customerCount: 3, totalOutstanding: 12000 },
      { executiveId: "e2", executiveName: "Bina", customerCount: 1, totalOutstanding: 4000 },
    ]);
    render(<AdminSeDuesCard />);
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("₹12,000")).toBeInTheDocument();
    expect(screen.getByText(/1 customer$/)).toBeInTheDocument(); // singular wording
  });

  it("shows an empty message when no SE has dues", async () => {
    fetchDuesByExecutive.mockResolvedValue([]);
    render(<AdminSeDuesCard />);
    expect(await screen.findByText("No outstanding dues.")).toBeInTheDocument();
  });

  it("hides when the fetch fails", async () => {
    fetchDuesByExecutive.mockRejectedValue(new Error("down"));
    const { container } = render(<AdminSeDuesCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("re-fetches on refreshSignal", async () => {
    fetchDuesByExecutive.mockResolvedValue([
      { executiveId: "e1", executiveName: "Asha", customerCount: 2, totalOutstanding: 5000 },
    ]);
    const { rerender } = render(<AdminSeDuesCard refreshSignal={0} />);
    await screen.findByText("Asha");
    fetchDuesByExecutive.mockResolvedValue([
      { executiveId: "e2", executiveName: "Chad", customerCount: 1, totalOutstanding: 7000 },
    ]);
    rerender(<AdminSeDuesCard refreshSignal={1} />);
    expect(await screen.findByText("Chad")).toBeInTheDocument();
  });

  it("hides when a pull-refresh fails", async () => {
    fetchDuesByExecutive.mockResolvedValue([
      { executiveId: "e1", executiveName: "Asha", customerCount: 2, totalOutstanding: 5000 },
    ]);
    const { rerender, container } = render(<AdminSeDuesCard refreshSignal={0} />);
    await screen.findByText("Asha");
    fetchDuesByExecutive.mockRejectedValue(new Error("down"));
    rerender(<AdminSeDuesCard refreshSignal={1} />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });
});

describe("AdminFulfillmentCard", () => {
  it("renders grouped stages, hiding zero-count ones (Cancelled always shown)", async () => {
    fetchFulfillmentSummary.mockResolvedValue(fulfillment);
    render(<AdminFulfillmentCard />);
    expect(await screen.findByText("Order fulfillment")).toBeInTheDocument();
    expect(screen.getByText("Ordered")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument(); // shown even though we could zero it
    expect(screen.queryByText("Partial inv.")).not.toBeInTheDocument(); // 0 → hidden
  });

  it("still shows the always-on Cancelled stage when every count is zero", async () => {
    fetchFulfillmentSummary.mockResolvedValue({
      ordered: 0, partiallyInvoiced: 0, invoiced: 0, partiallyDelivered: 0,
      delivered: 0, partiallyReturned: 0, returned: 0, cancelled: 0,
    });
    render(<AdminFulfillmentCard />);
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByText("Ordered")).not.toBeInTheDocument();
  });

  it("shows the skeleton while loading", () => {
    fetchFulfillmentSummary.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<AdminFulfillmentCard />);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("hides when the fetch fails with nothing to show", async () => {
    fetchFulfillmentSummary.mockRejectedValue(new Error("down"));
    const { container } = render(<AdminFulfillmentCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("re-fetches on refreshSignal", async () => {
    fetchFulfillmentSummary.mockResolvedValue(fulfillment);
    const { rerender } = render(<AdminFulfillmentCard refreshSignal={0} />);
    await screen.findByText("Order fulfillment");
    fetchFulfillmentSummary.mockResolvedValue({ ...fulfillment, returned: 4 });
    rerender(<AdminFulfillmentCard refreshSignal={1} />);
    expect(await screen.findByText("Returned")).toBeInTheDocument();
  });

  it("swallows a failed pull-refresh (shows the skeleton, no crash)", async () => {
    fetchFulfillmentSummary.mockResolvedValue(fulfillment);
    const { rerender } = render(<AdminFulfillmentCard refreshSignal={0} />);
    await screen.findByText("Order fulfillment");
    fetchFulfillmentSummary.mockRejectedValue(new Error("down"));
    rerender(<AdminFulfillmentCard refreshSignal={1} />);
    // Pull blanked to the skeleton (summary nulled); failed fetch leaves loading false → null.
    await waitFor(() => expect(screen.queryByText("Order fulfillment")).not.toBeInTheDocument());
  });
});
