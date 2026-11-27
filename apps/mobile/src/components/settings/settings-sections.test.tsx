import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { SettingsSections } from "./settings-sections";

beforeEach(() => (router.push as ReturnType<typeof vi.fn>).mockClear?.());

describe("SettingsSections", () => {
  it("navigates to change password and help (no self-edit profile)", () => {
    render(<SettingsSections />);
    expect(screen.queryByText("Edit profile")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Change password"));
    expect(router.push).toHaveBeenCalledWith("/settings/password");
    fireEvent.click(screen.getByText("Help"));
    expect(router.push).toHaveBeenCalledWith("/settings/about");
  });
});
