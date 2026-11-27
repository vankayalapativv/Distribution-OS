import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchTodayBeat = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../../lib/beat/today-beat-online", () => ({ fetchTodayBeat: (...a: unknown[]) => fetchTodayBeat(...a) }));
vi.mock("../../lib/auth", () => ({ useAuth: (sel?: (s: unknown) => unknown) => (sel ? sel({ token: "t" }) : { token: "t" }) }));
// Pin the clock to mid-morning IST so a `pending` stop stays pending (after
// 8 PM IST effectiveStopStatus would flip it to "missed" — making this test
// time-dependent otherwise).
vi.mock("../../lib/day-flag", async (imp) => ({ ...(await imp()), istHour: () => 10 }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { router } from "expo-router";
import { BeatCard } from "./beat-card";

const beat = (statuses: string[]) => ({ stops: statuses.map((stopStatus, i) => ({ id: `s${i}`, stopStatus })) });

beforeEach(() => {
  fetchTodayBeat.mockReset();
  (router.push as ReturnType<typeof vi.fn>).mockClear?.();
});

describe("BeatCard", () => {
  it("shows progress (done / total · missed) and taps through to the beat screen", async () => {
    fetchTodayBeat.mockResolvedValue(beat(["completed", "completed", "missed", "pending"]));
    render(<BeatCard />);
    expect(await screen.findByText(/2 of 4 stops done/)).toBeInTheDocument();
    expect(screen.getByText(/1 missed/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Today's beat"));
    expect(router.push).toHaveBeenCalledWith("/beat");
  });

  it("renders no missed segment when none are missed", async () => {
    fetchTodayBeat.mockResolvedValue(beat(["completed"]));
    render(<BeatCard />);
    expect(await screen.findByText(/1 of 1 stops done/)).toBeInTheDocument();
    expect(screen.queryByText(/missed/)).not.toBeInTheDocument();
  });

  it("hides the card once loaded with no stops", async () => {
    fetchTodayBeat.mockResolvedValue(beat([]));
    const { container } = render(<BeatCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("swallows a failed first fetch and hides the card", async () => {
    fetchTodayBeat.mockRejectedValue(new Error("offline"));
    const { container } = render(<BeatCard />);
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("swallows a failed pull-refresh and keeps prior data", async () => {
    fetchTodayBeat.mockResolvedValueOnce(beat(["completed", "pending"]));
    const onSettled = vi.fn();
    const { rerender } = render(<BeatCard refreshSignal={0} onSettled={onSettled} />);
    await screen.findByText(/1 of 2 stops done/);
    fetchTodayBeat.mockRejectedValue(new Error("offline"));
    rerender(<BeatCard refreshSignal={1} onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(screen.getByText(/1 of 2 stops done/)).toBeInTheDocument();
  });

  it("reports completion on refreshSignal and keeps prior data", async () => {
    fetchTodayBeat.mockResolvedValue(beat(["completed", "pending"]));
    const onSettled = vi.fn();
    const { rerender } = render(<BeatCard refreshSignal={0} onSettled={onSettled} />);
    await screen.findByText(/1 of 2 stops done/);
    rerender(<BeatCard refreshSignal={1} onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(screen.getByText(/1 of 2 stops done/)).toBeInTheDocument();
  });
});
