import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./target-progress-only", () => ({ TargetOnly: () => <div>TARGET_ONLY</div> }));

import { TargetProgress } from "./target-progress";
import type { PeriodProgress } from "./targets-api";

const progress = (over: Partial<PeriodProgress> = {}): PeriodProgress => ({
  periodStart: "2026-07-01",
  oilActual: [{ segment: "Car", litres: 30 }],
  oilTarget: [{ segment: "Car", litres: 60 }],
      ...over,
});

describe("TargetProgress", () => {
  it("delegates to TargetOnly for upcoming periods", () => {
    render(<TargetProgress progress={progress()} targetOnly />);
    expect(screen.getByText("TARGET_ONLY")).toBeInTheDocument();
  });

  it("shows oil bars + a total percentage for the current period", () => {
    render(<TargetProgress progress={progress()} />);
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && /Oil total/.test(el.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument(); // 30/60
  });

  it("omits the percentage when there is no oil target", () => {
    render(<TargetProgress progress={progress({ oilTarget: null })} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});
