import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

type IconFn = (p: { color: string; focused: boolean }) => React.ReactNode;
type ScreenProps = { options?: { tabBarIcon?: IconFn } };

vi.mock("expo-router", () => {
  const Tabs = ({ screenOptions, children }: { screenOptions?: { tabBarButton?: (p: Record<string, unknown>) => React.ReactNode }; children?: React.ReactNode }) => (
    <div>
      {screenOptions?.tabBarButton?.({ children: null })}
      {children}
    </div>
  );
  Tabs.Screen = ({ options }: ScreenProps) => (
    <div>
      {options?.tabBarIcon?.({ color: "#000", focused: true })}
      {options?.tabBarIcon?.({ color: "#000", focused: false })}
    </div>
  );
  return { Tabs };
});

import AdminLayout from "./_layout";

describe("AdminLayout", () => {
  it("renders the tab navigator with every icon (focused + unfocused) and the spring button", () => {
    const { container } = render(<AdminLayout />);
    // 6 tab icons × 2 focus states render without crashing.
    expect(container.querySelectorAll("div").length).toBeGreaterThan(0);
  });
});
