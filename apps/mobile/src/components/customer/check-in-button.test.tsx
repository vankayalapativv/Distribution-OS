import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckInButton } from "./check-in-button";

describe("CheckInButton", () => {
  it("shows a skeleton until the visit state is confirmed", () => {
    render(<CheckInButton state="none" busy={false} confirmed={false} onPress={vi.fn()} />);
    expect(screen.queryByText("Check in")).not.toBeInTheDocument();
  });

  it("checks in from the none state", () => {
    const onPress = vi.fn();
    render(<CheckInButton state="none" busy={false} confirmed onPress={onPress} />);
    fireEvent.click(screen.getByText("Check in"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the busy caption for an open visit", () => {
    render(<CheckInButton state="open" busy confirmed onPress={vi.fn()} />);
    expect(screen.getByText("Checking out…")).toBeInTheDocument();
  });

  it("shows the open check-out caption when idle", () => {
    render(<CheckInButton state="open" busy={false} confirmed onPress={vi.fn()} />);
    expect(screen.getByText("Check out")).toBeInTheDocument();
  });

  it("shows the busy check-in caption", () => {
    render(<CheckInButton state="none" busy confirmed onPress={vi.fn()} />);
    expect(screen.getByText("Checking in…")).toBeInTheDocument();
  });

  it("locks the done state", () => {
    const onPress = vi.fn();
    render(<CheckInButton state="done" busy={false} confirmed onPress={onPress} />);
    expect(screen.getByText("Visited today")).toBeInTheDocument();
  });
});
