import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { router } from "expo-router";

import AboutScreen from "./about";

describe("AboutScreen (Help)", () => {
  it("calls support, opens WhatsApp, and navigates back", () => {
    const spy = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    render(<AboutScreen />);
    fireEvent.click(screen.getByText("Call support"));
    expect(spy).toHaveBeenCalledWith("tel:+916304800595");
    fireEvent.click(screen.getByText("WhatsApp support"));
    expect(spy).toHaveBeenCalledWith("https://wa.me/916304800595");
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
    spy.mockRestore();
  });
});
