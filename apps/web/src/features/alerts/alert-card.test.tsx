import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertCard } from "./alert-card";
import type { Alert } from "./alerts-api";

const alert = (over: Partial<Alert> = {}): Alert =>
  ({ id: "a1", alertDate: "2026-09-14", alertType: "CREDIT_OVERDUE", severity: "high", customerId: null,
     customerName: null, executiveId: null, executiveName: null, alertMessage: "Overdue > 60 days",
     recommendedAction: null, status: "open", closedAt: null, createdAt: "2026-09-14T00:00:00Z", ...over } as Alert);

describe("AlertCard", () => {
  it("shows severity, type label, message and details", () => {
    render(<AlertCard alert={alert({ severity: "high", recommendedAction: "Call the customer", executiveName: "Ravi", customerName: "Sri Laxmi" })} closing={false} onClose={() => {}} />);
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Credit Overdue")).toBeInTheDocument();
    expect(screen.getByText("Overdue > 60 days")).toBeInTheDocument();
    expect(screen.getByText("Call the customer")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("Sri Laxmi")).toBeInTheDocument();
  });

  it("uses a muted pill for an unknown severity", () => {
    render(<AlertCard alert={alert({ severity: "critical" })} closing={false} onClose={() => {}} />);
    expect(screen.getByText("critical").className).toMatch(/bg-muted/);
  });

  it("falls back to the raw type code for unknown types", () => {
    render(<AlertCard alert={alert({ alertType: "TRACKING_COMMUNICATION_INTERRUPTED" })} closing={false} onClose={() => {}} />);
    expect(screen.getByText("TRACKING_COMMUNICATION_INTERRUPTED")).toBeInTheDocument();
  });

  it("closes an open alert on click", () => {
    const onClose = vi.fn();
    render(<AlertCard alert={alert()} closing={false} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(onClose).toHaveBeenCalledWith("a1");
  });

  it("shows a busy, disabled button while closing", () => {
    render(<AlertCard alert={alert()} closing onClose={() => {}} />);
    const btn = screen.getByRole("button", { name: /Closing/ });
    expect(btn).toBeDisabled();
  });

  it("shows a Closed label and no action for a closed alert", () => {
    render(<AlertCard alert={alert({ status: "closed" })} closing={false} onClose={() => {}} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
