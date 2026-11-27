import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { SettingsHeader } from "./settings-header";

describe("SettingsHeader", () => {
  it("renders the title and goes back on the chevron", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear?.();
    render(<SettingsHeader title="Edit profile" />);
    expect(screen.getByText("Edit profile")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });
});
