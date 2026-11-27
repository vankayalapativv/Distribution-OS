import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorScreen } from "./error-screen";

describe("ErrorScreen", () => {
  it("shows the friendly copy + the technical detail and fires retry", () => {
    const retry = vi.fn();
    render(<ErrorScreen error={new Error("boom detail")} retry={retry} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("boom detail")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Try again"));
    expect(retry).toHaveBeenCalled();
  });
});
