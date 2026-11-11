import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: (p: { role: string; children: React.ReactNode }) => (
    <div data-role={p.role}>{p.children}</div>
  ),
}));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <span data-testid="sk" /> }));

import Loading from "./loading";

describe("Users Loading", () => {
  it("renders the shell as SUPER_ADMIN with the Users column headers", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector("[data-role]")).toHaveAttribute("data-role", "SUPER_ADMIN");
    for (const header of ["User", "Contact", "Role", "Status", "Actions"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
  });

  it("renders a context-aware 8-row table shimmer", () => {
    const { container } = render(<Loading />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    // Plenty of shimmer bars: 8 rows × 7 cells-worth + header/filter bars.
    expect(screen.getAllByTestId("sk").length).toBeGreaterThan(40);
  });
});
