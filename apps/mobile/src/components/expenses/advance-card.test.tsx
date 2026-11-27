import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdvanceCard } from "./advance-card";

describe("AdvanceCard", () => {
  it("shows the outstanding advance and the request button", () => {
    const onRequest = vi.fn();
    render(<AdvanceCard outstandingTotal={8000} onRequest={onRequest} />);
    expect(screen.getByText("Advance to repay")).toBeInTheDocument();
    expect(screen.getByText("₹8,000")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Request an advance"));
    expect(onRequest).toHaveBeenCalled();
  });

  it("shows a prompt instead when nothing is outstanding", () => {
    render(<AdvanceCard outstandingTotal={0} onRequest={vi.fn()} />);
    expect(screen.getByText(/Need cash before salary day/)).toBeInTheDocument();
    expect(screen.queryByText("Advance to repay")).not.toBeInTheDocument();
  });
});
