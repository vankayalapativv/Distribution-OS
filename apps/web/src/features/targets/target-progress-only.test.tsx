import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TargetOnly } from "./target-progress-only";
import type { PeriodProgress } from "./targets-api";

const progress = (over: Partial<PeriodProgress> = {}): PeriodProgress => ({
  periodStart: "2026-07-01", oilActual: [], oilTarget: null, ...over,
});

describe("TargetOnly", () => {
  it("prompts when no target is set", () => {
    render(<TargetOnly progress={progress()} />);
    expect(screen.getByText("No target set for this period yet.")).toBeInTheDocument();
  });

  it("lists set segments and the oil total, dashing zeros", () => {
    render(
      <TargetOnly
        progress={progress({ oilTarget: [{ segment: "Car", litres: 40 }]})}
      />,
    );
    expect(screen.getAllByText("40 L").length).toBeGreaterThan(0); // Car target (+ oil total)
    expect(screen.getByText((_, el) => el?.tagName === "P" && /Oil total target/.test(el.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // other segments
  });

  it("dashes the unset oil segments when only one is set", () => {
    render(<TargetOnly progress={progress({ oilTarget: [{ segment: "Car", litres: 40 }]})} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
