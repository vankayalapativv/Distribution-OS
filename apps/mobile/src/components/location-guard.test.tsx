import { afterEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({
  state: { blocked: false, reason: null as string | null, recheck: () => {} },
}));
vi.mock("../lib/use-location-guard", () => ({ useLocationGuard: () => guard.state }));

import { fireEvent, render, screen } from "@testing-library/react";
import { BackHandler, Linking } from "react-native";
import { LocationGuard, swallowModalClose } from "./location-guard";

const L = Linking as unknown as { openSettings?: unknown; sendIntent?: unknown };

afterEach(() => {
  guard.state = { blocked: false, reason: null, recheck: () => {} };
  delete L.openSettings;
  delete L.sendIntent;
});

describe("LocationGuard", () => {
  it("renders children with no overlay when not blocked", () => {
    render(<LocationGuard><span>app</span></LocationGuard>);
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.queryByText(/Turn on Location/)).not.toBeInTheDocument();
  });

  it("shows the gps_off overlay and opens the location settings intent", () => {
    const sendIntent = vi.fn(() => Promise.resolve());
    L.sendIntent = sendIntent;
    L.openSettings = vi.fn(() => Promise.resolve());
    guard.state = { blocked: true, reason: "gps_off", recheck: () => {} };
    render(<LocationGuard><span>app</span></LocationGuard>);
    expect(screen.getByText("Turn on Location")).toBeInTheDocument();
    expect(swallowModalClose()).toBeUndefined(); // the modal's back no-op
    fireEvent.click(screen.getByText("Open location settings"));
    expect(sendIntent).toHaveBeenCalledWith("android.settings.LOCATION_SOURCE_SETTINGS");
  });

  it("opens app settings for a permission-denied reason and re-checks", () => {
    const openSettings = vi.fn(() => Promise.resolve());
    L.openSettings = openSettings;
    const recheck = vi.fn();
    guard.state = { blocked: true, reason: "foreground_denied", recheck };
    render(<LocationGuard><span>app</span></LocationGuard>);
    expect(screen.getByText(/Allow location for Distribution OS/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Open app settings"));
    expect(openSettings).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/re-check/));
    expect(recheck).toHaveBeenCalled();
  });

  it("swallows the Android hardware back button while blocked", () => {
    let backHandler: (() => boolean) | undefined;
    const remove = vi.fn();
    vi.spyOn(BackHandler, "addEventListener").mockImplementation(((_evt: string, cb: () => boolean) => {
      backHandler = cb;
      return { remove };
    }) as never);
    guard.state = { blocked: true, reason: "gps_off", recheck: () => {} };
    L.openSettings = vi.fn(() => Promise.resolve());
    const { unmount } = render(<LocationGuard><span>app</span></LocationGuard>);
    expect(backHandler?.()).toBe(true); // back press is swallowed
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("falls back to app settings when the location intent rejects", async () => {
    const openSettings = vi.fn(() => Promise.resolve());
    L.openSettings = openSettings;
    L.sendIntent = vi.fn(() => Promise.reject(new Error("no activity")));
    guard.state = { blocked: true, reason: "gps_off", recheck: () => {} };
    render(<LocationGuard><span>app</span></LocationGuard>);
    fireEvent.click(screen.getByText("Open location settings"));
    await vi.waitFor(() => expect(openSettings).toHaveBeenCalled());
  });

  it("falls back to app settings for gps_off when sendIntent is unavailable", () => {
    const openSettings = vi.fn(() => Promise.resolve());
    L.openSettings = openSettings;
    L.sendIntent = undefined; // non-Android: no sendIntent
    guard.state = { blocked: true, reason: "background_denied", recheck: () => {} };
    render(<LocationGuard><span>app</span></LocationGuard>);
    fireEvent.click(screen.getByText("Open app settings"));
    expect(openSettings).toHaveBeenCalled();
  });
});
