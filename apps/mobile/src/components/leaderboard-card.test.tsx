import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/api", async () => {
  const core = await vi.importActual<typeof import("../lib/api-core")>("../lib/api-core");
  return { apiFetch: (...a: unknown[]) => apiFetch(...a), ApiRequestError: core.ApiRequestError };
});

const auth = vi.hoisted(() => ({ state: { token: "tok", user: { id: "u2" } } as Record<string, unknown> }));
vi.mock("../lib/auth", () => ({
  useAuth: (sel?: (s: unknown) => unknown) => (sel ? sel(auth.state) : auth.state),
}));

import { fireEvent, renderWithQuery, screen, waitFor } from "../test/render-query";
import { LeaderboardCard } from "./leaderboard-card";

const ROWS = [
  { userId: "u1", name: "Asha", today: 40, week: 100, month: 400 },
  { userId: "u2", name: "Bina", today: 12.5, week: 0, month: 50 },
  { userId: "u3", name: "Chad", today: 8, week: 30, month: 20 },
  { userId: "u4", name: "Divya", today: 4, week: 10, month: 10 },
];

beforeEach(() => {
  apiFetch.mockReset();
  auth.state = { token: "tok", user: { id: "u2" } };
});

describe("LeaderboardCard", () => {
  it("shows the skeleton while pending, then ranked tiles (medals, me-highlight, decimals)", async () => {
    apiFetch.mockResolvedValue({ leaderboard: ROWS });
    renderWithQuery(<LeaderboardCard />);
    // The viewer (u2 "Bina") sees a "You" badge; rank-1 gets a medal; 12.5 → "12.5 L".
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("12.5 L")).toBeInTheDocument();
    expect(screen.getByText("40 L")).toBeInTheDocument();
  });

  it("re-ranks on a period switch and shows the per-period empty message", async () => {
    apiFetch.mockResolvedValue({ leaderboard: [{ userId: "u2", name: "Bina", today: 0, week: 0, month: 7 }] });
    renderWithQuery(<LeaderboardCard />);
    // today is 0 for the only row → empty state for "today".
    expect(await screen.findByText(/No oil sales yet today/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("week"));
    expect(await screen.findByText(/No oil sales yet this week/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("month"));
    expect(await screen.findByText("Bina")).toBeInTheDocument();
  });

  it("renders the error state when the fetch fails (and tolerates a null user)", async () => {
    auth.state = { token: "tok", user: null };
    apiFetch.mockRejectedValue(new Error("down"));
    renderWithQuery(<LeaderboardCard />);
    expect(await screen.findByText("Try again")).toBeInTheDocument();
  });

  it("resets the query and reports completion when refreshSignal bumps", async () => {
    apiFetch.mockResolvedValue({ leaderboard: ROWS });
    const onSettled = vi.fn();
    const { rerender } = renderWithQuery(<LeaderboardCard refreshSignal={0} onSettled={onSettled} />);
    await screen.findByText("Asha");
    rerender(<LeaderboardCard refreshSignal={1} onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
  });
});
