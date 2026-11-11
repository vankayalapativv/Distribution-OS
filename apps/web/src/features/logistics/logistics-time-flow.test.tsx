import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogisticsTimeFlow } from "./logistics-time-flow";

describe("LogisticsTimeFlow", () => {
  it("shows both times and the duration for an ended run", () => {
    render(<LogisticsTimeFlow startedAt="2026-09-14T02:42:00Z" endedAt="2026-09-14T10:17:00Z" status="ended" />);
    expect(screen.getByText("7h 35m")).toBeInTheDocument();
    expect(screen.queryByText("live")).not.toBeInTheDocument();
  });

  it("shows 'live' and an elapsed duration for an active run", () => {
    render(<LogisticsTimeFlow startedAt="2026-09-14T02:42:00Z" endedAt={null} status="active" />);
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByText(/elapsed/)).toBeInTheDocument();
  });
});
