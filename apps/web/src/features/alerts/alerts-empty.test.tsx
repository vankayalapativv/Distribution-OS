import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertsEmpty } from "./alerts-empty";

describe("AlertsEmpty", () => {
  it("uses the friendly all-caught-up wording on the open tab", () => {
    render(<AlertsEmpty statusFilter="open" />);
    expect(screen.getByText("No open alerts.")).toBeInTheDocument();
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it("uses the neutral wording on other tabs", () => {
    render(<AlertsEmpty statusFilter="closed" />);
    expect(screen.getByText("No alerts.")).toBeInTheDocument();
    expect(screen.queryByText(/All caught up/)).not.toBeInTheDocument();
  });
});
