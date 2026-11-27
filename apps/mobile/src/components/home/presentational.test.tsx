import { afterEach, describe, expect, it, vi } from "vitest";

// admin-drill (for kpi-drill-row's METRIC_META) imports api/auth → expo-secure-store.
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: () => ({ token: "t" }) }));

import { fireEvent, render, screen } from "@testing-library/react";
import { GreetingHeader } from "./greeting-header";
import { KpiCard, type Accent } from "./kpi-card";
import { KpiDrillRow } from "./kpi-drill-row";
import { BeatCardSkeleton } from "./beat-card-skeleton";
import { DayEndedCard } from "./day-ended-card";
import type { AgentRow } from "../../lib/admin-drill";

const accent: Accent = { icon: "cart", fg: "#2563eb", badge: "bg-blue-50" };

afterEach(() => vi.useRealTimers());

describe("GreetingHeader", () => {
  it("shimmers until a name is available", () => {
    const { container } = render(<GreetingHeader name="" />);
    // No greeting text while the name is missing — just skeletons.
    expect(container.textContent).toBe("");
  });

  it("greets by time of day and ticks the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T09:00:00"));
    render(<GreetingHeader name="Asha" />);
    expect(screen.getByText(/Good morning, Asha/)).toBeInTheDocument();
    // Advance past a tick interval → re-renders without crashing.
    vi.advanceTimersByTime(15_000);
    expect(screen.getByText(/Good morning, Asha/)).toBeInTheDocument();
  });

  it.each([
    [new Date("2026-11-27T13:00:00"), "Good afternoon"],
    [new Date("2026-11-27T19:00:00"), "Good evening"],
    [new Date("2026-11-27T23:00:00"), "Good night"],
  ])("maps the hour to the right greeting", (when, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(when);
    render(<GreetingHeader name="Bina" />);
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });
});

describe("KpiCard", () => {
  it("shimmers the value until it loads, then renders it", () => {
    const { rerender } = render(<KpiCard label="Orders" accent={accent} />);
    expect(screen.getByText("Orders")).toBeInTheDocument();
    rerender(<KpiCard label="Orders" value="8" sub="8 orders" subDynamic accent={accent} />);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("8 orders")).toBeInTheDocument();
  });

  it("renders a static subline and fires onPress", () => {
    const onPress = vi.fn();
    render(<KpiCard label="Live" value="3" sub="live now" accent={accent} onPress={onPress} />);
    fireEvent.click(screen.getByText("Live"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shimmers a dynamic subline while it is still loading", () => {
    render(<KpiCard label="Orders" value="8" subDynamic accent={accent} />);
    // sub undefined + subDynamic → the subline shimmers (no text node for it).
    expect(screen.queryByText(/orders/)).not.toBeInTheDocument();
  });
});

describe("KpiDrillRow", () => {
  const row: AgentRow = {
    agentId: "a1",
    agentName: "Asha",
    live: true,
    visits: 4,
    productiveVisits: 3,
    customers: 2,
  };

  it("renders the executives metric with a live tone", () => {
    render(<KpiDrillRow metric="executives" row={row} first />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders an offline executive with a muted tone", () => {
    render(
      <KpiDrillRow metric="executives" row={{ ...row, live: false }} first={false} />,
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("renders a collections row (default tone, ₹ value)", () => {
    render(
      <KpiDrillRow
        metric="collections"
        row={{ agentId: "a3", agentName: "Chad", amount: 5000, collections: 2 }}
        first
      />,
    );
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
  });

  it("shows a colour-graded productivity pill", () => {
    render(<KpiDrillRow metric="productivity" row={row} first={false} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("omits the pill when there are no visits (muted/offline tone)", () => {
    render(
      <KpiDrillRow metric="productivity" row={{ agentId: "a2", agentName: "Bina", visits: 0 }} first />,
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("treats a missing productiveVisits as zero in the pill", () => {
    render(
      <KpiDrillRow metric="productivity" row={{ agentId: "a4", agentName: "Devi", visits: 4 }} first />,
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("static placeholders", () => {
  it("BeatCardSkeleton and DayEndedCard render", () => {
    expect(render(<BeatCardSkeleton />).container.querySelector("div")).not.toBeNull();
    render(<DayEndedCard />);
    expect(screen.getByText("Day ended")).toBeInTheDocument();
  });
});
