import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertsStatusFilter } from "./alerts-status-filter";

describe("AlertsStatusFilter", () => {
  it("renders the three options and highlights the active one", () => {
    render(<AlertsStatusFilter value="open" onChange={() => {}} />);
    expect(screen.getByText("Open").className).toMatch(/bg-primary/);
    expect(screen.getByText("All").className).not.toMatch(/bg-primary/);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("emits the chosen filter", () => {
    const onChange = vi.fn();
    render(<AlertsStatusFilter value="open" onChange={onChange} />);
    fireEvent.click(screen.getByText("Closed"));
    expect(onChange).toHaveBeenCalledWith("closed");
  });
});
