import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FeedbackBanner } from "./feedback-banner";
import { ErrorBanner } from "./error-banner";
import { OfflineBanner } from "./offline-banner";

describe("FeedbackBanner", () => {
  it("shows the message and an optional title", () => {
    render(<FeedbackBanner variant="warning" title="Heads up" message="Low stock" />);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  it("renders a Try again control that calls onRetry", () => {
    const onRetry = vi.fn();
    render(<FeedbackBanner message="Load failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("omits the retry control when no handler is given", () => {
    render(<FeedbackBanner message="Just info" variant="info" />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });
});

describe("ErrorBanner", () => {
  it("renders an error-variant feedback banner, forwarding onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Something broke" onRetry={onRetry} />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("OfflineBanner", () => {
  it("shows the last-synced notice", () => {
    render(<OfflineBanner />);
    expect(screen.getByText("Showing last synced data")).toBeInTheDocument();
  });
});
