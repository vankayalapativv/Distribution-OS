import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("labels every known status", () => {
    const { rerender } = render(<StatusPill status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    rerender(<StatusPill status="checked_in" />);
    expect(screen.getByText("Checked in")).toBeInTheDocument();
    rerender(<StatusPill status="completed" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    rerender(<StatusPill status="missed" />);
    expect(screen.getByText("Missed")).toBeInTheDocument();
  });

  it("falls back to the raw status (and pending style) for an unknown value", () => {
    render(<StatusPill status="weird" />);
    expect(screen.getByText("weird")).toBeInTheDocument();
  });
});
