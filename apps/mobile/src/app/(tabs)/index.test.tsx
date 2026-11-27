import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

let appStateCb: ((s: string) => void) | null = null;
const appStateRemove = vi.fn();
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  return {
    ...actual,
    AppState: { addEventListener: (_t: string, cb: (s: string) => void) => { appStateCb = cb; return { remove: appStateRemove }; } },
    RefreshControl: ({ onRefresh, children }: { onRefresh: () => void; children?: React.ReactNode }) => (
      <div>{children}<button type="button" onClick={onRefresh}>pull-refresh</button></div>
    ),
  };
});

const useAuth = vi.fn();
const useDayTracking = vi.fn();
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => useAuth(sel) }));
vi.mock("../../lib/use-day-tracking", () => ({ useDayTracking: (a: unknown) => useDayTracking(a) }));
vi.mock("../../lib/use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<void>) => ({ refreshing: false, onRefresh: fn }) }));
vi.mock("../../components/dialog", () => ({ useDialog: () => ({ confirm: vi.fn(), prompt: vi.fn() }) }));
vi.mock("../../components/home/greeting-header", () => ({ GreetingHeader: ({ name }: { name: string }) => <span>hi-{name}</span> }));
vi.mock("../../components/home/day-ended-card", () => ({ DayEndedCard: () => <span>day-ended</span> }));
vi.mock("../../components/home/end-day-button", () => ({ EndDayButton: ({ onPress }: { onPress: () => void }) => <button type="button" onClick={onPress}>end-day</button> }));
vi.mock("../../components/home/start-day-button", () => ({ StartDayButton: ({ onPress }: { onPress: () => void }) => <button type="button" onClick={onPress}>start-day</button> }));
vi.mock("../../components/home/beat-card", () => ({ BeatCard: ({ onSettled }: { onSettled: () => void }) => <button type="button" onClick={onSettled}>beat-settle</button> }));
vi.mock("../../components/performance-card", () => ({ PerformanceCard: () => null }));
vi.mock("../../components/leaderboard-card", () => ({ LeaderboardCard: () => null }));
vi.mock("../../components/dues-card", () => ({ DuesCard: () => null }));

import HomeScreen from "./index";

const day = (over: Record<string, unknown> = {}) =>
  ({ dayOn: false, dayEnded: false, dayBusy: false, onStartDay: vi.fn(), onEndDay: vi.fn(), ...over });

describe("HomeScreen", () => {
  it("shows Start day, foregrounds to refresh, and settles the pull-refresh", () => {
    useAuth.mockImplementation((sel) => sel({ user: { name: "Ravi" } }));
    const onStartDay = vi.fn();
    useDayTracking.mockReturnValue(day({ onStartDay }));
    render(<HomeScreen />);
    expect(screen.getByText("hi-Ravi")).toBeInTheDocument();
    fireEvent.click(screen.getByText("start-day"));
    expect(onStartDay).toHaveBeenCalled();

    // Foreground resume → refetch (AppState "active" branch).
    act(() => appStateCb?.("active"));
    act(() => appStateCb?.("background")); // non-active branch

    // Drive pull-to-refresh, then settle all four cards so the promise resolves.
    fireEvent.click(screen.getByText("pull-refresh"));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText("beat-settle"));
  });

  it("shows the End day button while the day is on", () => {
    useAuth.mockImplementation((sel) => sel({ user: null }));
    const onEndDay = vi.fn();
    useDayTracking.mockReturnValue(day({ dayOn: true, onEndDay }));
    render(<HomeScreen />);
    fireEvent.click(screen.getByText("end-day"));
    expect(onEndDay).toHaveBeenCalled();
    expect(screen.queryByText("start-day")).not.toBeInTheDocument();
  });

  it("shows the day-ended card once the day is over", () => {
    useAuth.mockImplementation((sel) => sel({ user: { name: "A" } }));
    useDayTracking.mockReturnValue(day({ dayOn: false, dayEnded: true }));
    render(<HomeScreen />);
    expect(screen.getByText("day-ended")).toBeInTheDocument();
  });
});
