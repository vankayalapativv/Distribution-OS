import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Row, SectionLabel } from "./settings-rows";

describe("settings Row + SectionLabel", () => {
  it("Row renders label + hint and fires onPress", () => {
    const onPress = vi.fn();
    render(<Row label="Change password" hint="Last changed 3 months ago" onPress={onPress} />);
    expect(screen.getByText("Change password")).toBeInTheDocument();
    expect(screen.getByText("Last changed 3 months ago")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Change password"));
    expect(onPress).toHaveBeenCalled();
  });

  it("Row without a hint, and the danger variant", () => {
    render(<Row label="Sign out" danger onPress={() => {}} />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("SectionLabel renders its heading", () => {
    render(<SectionLabel>Account</SectionLabel>);
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
