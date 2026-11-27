import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useTodayBeat = vi.fn();
const isStopDone = vi.fn();
const effectiveStopStatus = vi.fn();
vi.mock("../lib/beat/use-today-beat", () => ({ useTodayBeat: () => useTodayBeat() }));
vi.mock("../lib/use-pull-refresh", () => ({ usePullRefresh: () => ({ refreshing: false, onRefresh: vi.fn() }) }));
vi.mock("../lib/beat/stop-status", () => ({
  isStopDone: (s: unknown) => isStopDone(s),
  effectiveStopStatus: (s: unknown) => effectiveStopStatus(s),
}));
vi.mock("../components/beat/stop-row", () => ({ StopRow: ({ stop }: { stop: { stopId: string } }) => <span>stop-{stop.stopId}</span> }));

import BeatScreen from "./beat";

describe("BeatScreen", () => {
  it("shows the skeleton while loading", () => {
    useTodayBeat.mockReturnValue({ beat: null, loading: true, refresh: vi.fn() });
    render(<BeatScreen />);
    expect(screen.getByText("Today's beat")).toBeInTheDocument();
    expect(screen.queryByText("No beat today")).not.toBeInTheDocument();
  });

  it("shows the empty state and navigates back", () => {
    useTodayBeat.mockReturnValue({ beat: { planDate: null, stops: [] }, loading: false, refresh: vi.fn() });
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    render(<BeatScreen />);
    expect(screen.getByText("No beat today")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("chevron-back"));
    expect(router.back).toHaveBeenCalled();
  });

  it("lists stops with a progress + missed subtitle and a formatted date", () => {
    isStopDone.mockImplementation((s) => s === "done");
    effectiveStopStatus.mockImplementation((s) => s);
    useTodayBeat.mockReturnValue({
      beat: { planDate: "2026-08-20", stops: [
        { stopId: "s1", stopStatus: "done" },
        { stopId: "s2", stopStatus: "missed" },
        { stopId: "s3", stopStatus: "pending" },
      ] },
      loading: false,
      refresh: vi.fn(),
    });
    render(<BeatScreen />);
    expect(screen.getByText("stop-s1")).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 done · 1 missed/)).toBeInTheDocument();
  });

  it("falls back to 'Today' for a missing or invalid plan date", () => {
    isStopDone.mockReturnValue(false);
    effectiveStopStatus.mockReturnValue("pending");
    useTodayBeat.mockReturnValue({ beat: { planDate: "not-a-date", stops: [{ stopId: "s1", stopStatus: "pending" }] }, loading: false, refresh: vi.fn() });
    render(<BeatScreen />);
    expect(screen.getByText("Today · 0 of 1 done")).toBeInTheDocument();
  });
});
