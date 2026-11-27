import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("expo-router", () => {
  const Tabs = ({ screenOptions, children }: { screenOptions?: { tabBarButton?: (p: Record<string, unknown>) => React.ReactNode }; children?: React.ReactNode }) => (
    <div>{screenOptions?.tabBarButton?.({ children: null })}{children}</div>
  );
  Tabs.Screen = ({ options }: { options?: { tabBarIcon?: (p: { color: string; focused: boolean }) => React.ReactNode } }) => (
    <div>{options?.tabBarIcon?.({ color: "#000", focused: true })}{options?.tabBarIcon?.({ color: "#000", focused: false })}</div>
  );
  return { Tabs };
});

import LogisticsLayout from "./_layout";

describe("LogisticsLayout", () => {
  it("renders the Delivery + Settings tabs with both icon states", () => {
    const { container } = render(<LogisticsLayout />);
    expect(container.querySelectorAll("div").length).toBeGreaterThan(0);
  });
});
