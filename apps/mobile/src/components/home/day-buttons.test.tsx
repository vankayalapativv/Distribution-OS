import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StartDayButton } from "./start-day-button";
import { EndDayButton } from "./end-day-button";

describe("StartDayButton", () => {
  it("fires onPress when idle", () => {
    const onPress = vi.fn();
    render(<StartDayButton busy={false} onPress={onPress} />);
    fireEvent.click(screen.getByText("Start day"));
    expect(onPress).toHaveBeenCalled();
  });

  it("is disabled while busy", () => {
    const onPress = vi.fn();
    render(<StartDayButton busy onPress={onPress} />);
    fireEvent.click(screen.getByText("Start day"));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("EndDayButton", () => {
  it("shows the idle label and fires onPress", () => {
    const onPress = vi.fn();
    render(<EndDayButton busy={false} onPress={onPress} />);
    fireEvent.click(screen.getByText("End day"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the ending label and is disabled while busy", () => {
    const onPress = vi.fn();
    render(<EndDayButton busy onPress={onPress} />);
    fireEvent.click(screen.getByText("Ending…"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
