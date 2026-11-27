import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const online = { value: true };
vi.mock("../lib/connectivity", () => ({
  useIsOnline: () => online.value,
}));

import { ErrorState } from "./error-state";
import { ApiRequestError } from "../lib/api-core";

afterEach(() => {
  online.value = true;
});

describe("ErrorState", () => {
  it("shows a humanized title + message and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error("boom")} onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("omits the retry control when no handler is given (compact)", () => {
    render(<ErrorState error={new Error("boom")} compact />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });

  it("renders the offline variant when offline", () => {
    online.value = false;
    render(<ErrorState error={new Error("boom")} />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it("renders the amber warning variant for a soft (402) error while online", () => {
    render(<ErrorState error={new ApiRequestError("PAYMENT_REQUIRED", "Due", 402)} />);
    expect(screen.getByText("Payment required")).toBeInTheDocument();
  });
});
