import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogisticsStatusPill } from "./logistics-status-pill";

describe("LogisticsStatusPill", () => {
  it("shows Active when the run has no end time", () => {
    render(<LogisticsStatusPill status="active" endedAt={null} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Ended once the run has an end time", () => {
    render(<LogisticsStatusPill status="ended" endedAt="2026-09-14T10:00:00Z" />);
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });
});
