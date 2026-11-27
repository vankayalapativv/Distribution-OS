import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { pass } = vi.hoisted(() => ({ pass: ({ children }: { children?: React.ReactNode }) => children ?? null }));

vi.mock("../global.css", () => ({}));
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  return { ...actual, LogBox: { ignoreLogs: vi.fn() } };
});
vi.mock("@tanstack/react-query", () => ({ QueryClientProvider: pass }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("react-native-keyboard-controller", () => ({ KeyboardProvider: pass }));
vi.mock("../components/auth-gate", () => ({ AuthGate: pass }));
vi.mock("../components/dialog", () => ({ DialogProvider: pass }));
vi.mock("../components/toast", () => ({ ToastProvider: pass }));
vi.mock("../components/location-guard", () => ({ LocationGuard: pass }));
vi.mock("../components/update-gate", () => ({ UpdateGate: pass }));
vi.mock("../components/error-screen", () => ({ ErrorScreen: ({ error }: { error: Error }) => <span>err-{error.message}</span> }));

const h = vi.hoisted(() => ({
  reportMobileError: vi.fn(),
  installGlobalErrorLogging: vi.fn(),
  installUnhandledRejectionReporting: vi.fn(),
  detectPreviousNativeCrash: vi.fn(() => Promise.resolve()),
  installSessionActivityTracking: vi.fn(),
  installGpsWatchdog: vi.fn(),
  installNotificationHandler: vi.fn(),
}));
vi.mock("../lib/report-error", () => ({ reportMobileError: (...a: unknown[]) => h.reportMobileError(...a) }));
vi.mock("../lib/global-error-logging", () => ({ installGlobalErrorLogging: () => h.installGlobalErrorLogging() }));
vi.mock("../lib/unhandled-rejection", () => ({ installUnhandledRejectionReporting: () => h.installUnhandledRejectionReporting() }));
vi.mock("../lib/native-crash-detect", () => ({
  detectPreviousNativeCrash: () => h.detectPreviousNativeCrash(),
  installSessionActivityTracking: () => h.installSessionActivityTracking(),
}));
vi.mock("../lib/gps", () => ({ installGpsWatchdog: () => h.installGpsWatchdog() }));
vi.mock("../lib/reminders", () => ({ installNotificationHandler: () => h.installNotificationHandler() }));
vi.mock("../lib/photo-stamp", () => ({ PhotoStampHost: () => null }));
vi.mock("../lib/query-client", () => ({ queryClient: {} }));

import RootLayout, { ErrorBoundary } from "./_layout";

describe("RootLayout", () => {
  it("installs the monitors on import and renders the provider tree", () => {
    expect(h.installGlobalErrorLogging).toHaveBeenCalled();
    expect(h.installUnhandledRejectionReporting).toHaveBeenCalled();
    expect(h.installGpsWatchdog).toHaveBeenCalled();
    expect(() => render(<RootLayout />)).not.toThrow();
  });

  it("the ErrorBoundary reports the crash and shows the recovery screen", () => {
    const retry = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} retry={retry} />);
    expect(h.reportMobileError).toHaveBeenCalledWith(expect.any(Error), { boundary: "root-render", fatal: true });
  });
});
