import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegacyMetricCards } from "./legacy-metric-cards";

describe("LegacyMetricCards", () => {
  it("renders a tile per metric with its value and label", () => {
    render(
      <LegacyMetricCards
        metrics={[
          { label: "Sales Value", value: "185000" },
          { label: "Collections", value: "74000" },
        ]}
      />,
    );
    expect(screen.getByText("Sales Value")).toBeInTheDocument();
    expect(screen.getByText("185000")).toBeInTheDocument();
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("renders an empty grid when there are no metrics", () => {
    render(<LegacyMetricCards metrics={[]} />);
    expect(screen.getByLabelText("Dashboard metrics")).toBeInTheDocument();
  });
});
