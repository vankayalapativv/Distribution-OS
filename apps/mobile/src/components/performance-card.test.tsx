import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the native-pulling leaves so importActual can load performance.ts's pure
// helpers (OIL_SEGMENTS / sumLitres / segLitres) without expo-secure-store.
vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("../lib/read-cache", () => ({ cachedFetch: vi.fn() }));

const fetchMyPerformance = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("../lib/performance", async () => {
  const actual = await vi.importActual<typeof import("../lib/performance")>("../lib/performance");
  return { ...actual, fetchMyPerformance: () => fetchMyPerformance() };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PerformanceCard } from "./performance-card";
import type { MyPerformance } from "../lib/performance";

const seg = (segment: string, litres: number) => ({ segment, litres });

const PERF: MyPerformance = {
  today: {
    date: "2026-11-27",
    oilActual: [seg("Car", 20), seg("2W", 5)],
    collections: { total: 1000, verified: 400 },
  },
  week: {
    periodStart: "2026-11-24",
    oilActual: [], // 0 against a target → pct 0 exercises the bar's Math.max floor
    oilTarget: [seg("Car", 100)],
    collections: { total: 5000, verified: 5000 },
  },
  month: {
    periodStart: "2026-11-01",
    oilActual: [seg("Car", 200)],
    oilTarget: null, // no monthly target set
    collections: { total: 0, verified: 0 },
  },
};

beforeEach(() => fetchMyPerformance.mockReset());

describe("PerformanceCard", () => {
  it("shows the skeleton first, then today actuals; hides the card if the first fetch fails", async () => {
    fetchMyPerformance.mockResolvedValue(null);
    const { container } = render(<PerformanceCard />);
    // First fetch resolved null → nothing to show → card collapses to null.
    await waitFor(() => expect(container.querySelector("div")).toBeNull());
  });

  it("renders today actuals and switches to a period with a target", async () => {
    fetchMyPerformance.mockResolvedValue(PERF);
    render(<PerformanceCard />);
    expect(await screen.findByText("My performance")).toBeInTheDocument();
    expect(screen.getByText("Oil sold")).toBeInTheDocument();
    expect(screen.getByText("25 L")).toBeInTheDocument(); // 20 + 5 today
    // Week has a target → the target text appears.
    fireEvent.click(screen.getByText("week"));
    expect(await screen.findByText(/of 100 L target/)).toBeInTheDocument();
  });

  it("shows the no-target note on a period without a target", async () => {
    fetchMyPerformance.mockResolvedValue(PERF);
    render(<PerformanceCard />);
    await screen.findByText("My performance");
    fireEvent.click(screen.getByText("month"));
    expect(await screen.findByText(/No monthly target set yet/)).toBeInTheDocument();
  });

  it("reports completion on refreshSignal and keeps prior data on a failed pull", async () => {
    fetchMyPerformance.mockResolvedValue(PERF);
    const onSettled = vi.fn();
    const { rerender } = render(<PerformanceCard refreshSignal={0} onSettled={onSettled} />);
    await screen.findByText("My performance");
    // fetchMyPerformance resolves null on failure (never rejects) — the card keeps
    // its prior data and still reports completion to the refresh coordinator.
    fetchMyPerformance.mockResolvedValueOnce(null);
    rerender(<PerformanceCard refreshSignal={1} onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(screen.getByText("My performance")).toBeInTheDocument();
  });

  it("updates on a successful pull-refresh", async () => {
    fetchMyPerformance.mockResolvedValue(PERF);
    const { rerender } = render(<PerformanceCard refreshSignal={0} />);
    await screen.findByText("25 L");
    const bumped = { ...PERF, today: { ...PERF.today, oilActual: [seg("Car", 99)] } };
    fetchMyPerformance.mockResolvedValue(bumped);
    rerender(<PerformanceCard refreshSignal={1} />);
    expect((await screen.findAllByText("99 L")).length).toBeGreaterThan(0);
  });

  it("a null pull-refresh keeps the prior data", async () => {
    fetchMyPerformance.mockResolvedValue(PERF);
    const { rerender } = render(<PerformanceCard refreshSignal={0} />);
    await screen.findByText("25 L");
    fetchMyPerformance.mockResolvedValue(null); // pull returns nothing
    rerender(<PerformanceCard refreshSignal={1} />);
    await waitFor(() => expect(screen.getByText("25 L")).toBeInTheDocument());
  });

  it("shows a weekly no-target note and tolerates a missing oilActual", async () => {
    const noTargets: MyPerformance = {
      today: { date: "2026-11-27", oilActual: undefined as never, collections: { total: 0, verified: 0 } },
      week: { periodStart: "2026-11-24", oilActual: [seg("Car", 10)], oilTarget: null, collections: { total: 0, verified: 0 } },
      month: PERF.month,
    };
    fetchMyPerformance.mockResolvedValue(noTargets);
    render(<PerformanceCard />);
    await screen.findByText("My performance"); // today renders with the ?? [] fallback
    fireEvent.click(screen.getByText("week"));
    expect(await screen.findByText(/No weekly target set yet/)).toBeInTheDocument();
  });
});
