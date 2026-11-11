import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionRole = vi.fn();
vi.mock("@/features/auth/auth-role", () => ({ getSessionRole: () => getSessionRole() }));
vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: (p: { role: string; children: React.ReactNode }) => (
    <div data-role={p.role}>{p.children}</div>
  ),
}));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <span data-testid="sk" /> }));

import Loading from "./loading";

beforeEach(() => getSessionRole.mockReset());

describe("customer detail Loading", () => {
  it("renders the shell with the session role and the tab labels", async () => {
    getSessionRole.mockResolvedValue({ role: "SUPER_ADMIN" });
    const { container } = render(await Loading());
    expect(container.querySelector("[data-role]")).toHaveAttribute("data-role", "SUPER_ADMIN");
    // header + tab-bar (4) + 5 info cards (1 title + 12 bars each) → many skeletons
    expect(screen.getAllByTestId("sk").length).toBeGreaterThan(20);
  });

  it("falls back to MANAGER when there is no session", async () => {
    getSessionRole.mockResolvedValue(null);
    const { container } = render(await Loading());
    expect(container.querySelector("[data-role]")).toHaveAttribute("data-role", "MANAGER");
  });
});
