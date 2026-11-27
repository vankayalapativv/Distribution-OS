import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Row, SectionLabel } from "./settings-rows";

describe("admin settings-rows", () => {
  it("Row fires onPress; SectionLabel renders", () => {
    const onPress = vi.fn();
    render(<Row label="Manage users" onPress={onPress} />);
    fireEvent.click(screen.getByText("Manage users"));
    expect(onPress).toHaveBeenCalled();
    render(<SectionLabel>Admin</SectionLabel>);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });
});
