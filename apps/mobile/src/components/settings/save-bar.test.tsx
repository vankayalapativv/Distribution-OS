import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SaveBar } from "./save-bar";

describe("SaveBar", () => {
  it("fires onPress when enabled", () => {
    const onPress = vi.fn();
    render(<SaveBar label="Save changes" busy={false} canSave onPress={onPress} />);
    fireEvent.click(screen.getByText("Save changes"));
    expect(onPress).toHaveBeenCalled();
  });

  it("is disabled when canSave is false", () => {
    const onPress = vi.fn();
    render(<SaveBar label="Save changes" busy={false} canSave={false} onPress={onPress} />);
    fireEvent.click(screen.getByText("Save changes"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows a spinner instead of the label while busy", () => {
    render(<SaveBar label="Save changes" busy canSave onPress={() => {}} />);
    expect(screen.queryByText("Save changes")).not.toBeInTheDocument();
  });
});
