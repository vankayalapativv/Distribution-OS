import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/api", async () => {
  const core = await vi.importActual<typeof import("../lib/api-core")>("../lib/api-core");
  return { apiFetch: (...a: unknown[]) => apiFetch(...a), ApiRequestError: core.ApiRequestError };
});

const auth = vi.hoisted(() => ({ state: { token: "tok", user: { id: "u1" } } as Record<string, unknown> }));
vi.mock("../lib/auth", () => ({
  useAuth: (sel?: (s: unknown) => unknown) => (sel ? sel(auth.state) : auth.state),
}));

import { fireEvent, renderWithQuery, screen, waitFor } from "../test/render-query";
import { SegmentSalesCard } from "./segment-sales-card";
import { SEGMENTS, type SegmentLitres } from "../lib/segment-sales";

const litres = (over: Partial<SegmentLitres>): SegmentLitres =>
  ({ ...(Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as SegmentLitres), ...over });

const zero = litres({});
const data = {
  rows: [
    { userId: "u1", name: "Asha", today: litres({ Car: 20 }), week: zero, month: litres({ "2W": 5 }) },
    { userId: "u2", name: "Bina", today: litres({ "2W": 8 }), week: zero, month: zero },
  ],
};

beforeEach(() => {
  apiFetch.mockReset();
  auth.state = { token: "tok", user: { id: "u1" } };
});

describe("SegmentSalesCard", () => {
  it("shows ranked rows, and expands one on tap", async () => {
    apiFetch.mockResolvedValue(data);
    renderWithQuery(<SegmentSalesCard />);
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Bina")).toBeInTheDocument();
    // Expand Asha's row → its collapsed caret flips.
    fireEvent.click(screen.getByText("Asha"));
    expect(await screen.findByText("▾")).toBeInTheDocument();
    // Tap again → collapses back.
    fireEvent.click(screen.getByText("Asha"));
    await waitFor(() => expect(screen.queryByText("▾")).not.toBeInTheDocument());
  });

  it("shows the per-period empty message when a period is all-zero", async () => {
    apiFetch.mockResolvedValue(data);
    renderWithQuery(<SegmentSalesCard />);
    await screen.findByText("Asha");
    fireEvent.click(screen.getByText("week"));
    expect(await screen.findByText(/No oil sales yet this week/)).toBeInTheDocument();
  });

  it("shows the today empty message when there are no sales today", async () => {
    apiFetch.mockResolvedValue({ rows: [{ userId: "u1", name: "Asha", today: zero, week: zero, month: litres({ Car: 3 }) }] });
    renderWithQuery(<SegmentSalesCard />);
    expect(await screen.findByText(/No oil sales yet today/)).toBeInTheDocument();
  });

  it("renders the error state when the fetch fails", async () => {
    apiFetch.mockRejectedValue(new Error("down"));
    renderWithQuery(<SegmentSalesCard />);
    expect(await screen.findByText("Try again")).toBeInTheDocument();
  });

  it("resets the query when refreshSignal bumps", async () => {
    apiFetch.mockResolvedValue(data);
    const { rerender } = renderWithQuery(<SegmentSalesCard refreshSignal={0} />);
    await screen.findByText("Asha");
    apiFetch.mockClear();
    rerender(<SegmentSalesCard refreshSignal={1} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  });
});
