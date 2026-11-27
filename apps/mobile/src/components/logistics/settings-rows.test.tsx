import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Row, SectionLabel } from "./settings-rows";

describe("logistics settings-rows", () => {
  it("Row renders its label and fires onPress", () => {
    const onPress = vi.fn();
    render(<Row label="Change password" onPress={onPress} />);
    fireEvent.click(screen.getByText("Change password"));
    expect(onPress).toHaveBeenCalled();
  });

  it("SectionLabel renders its heading", () => {
    render(<SectionLabel>Account</SectionLabel>);
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
