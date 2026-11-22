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
  it("renders the real chrome (Add User + search + filters), not a shimmer", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector("[data-role]")).toHaveAttribute("data-role", "SUPER_ADMIN");
    expect(screen.getByRole("button", { name: "+ Add User" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search name/)).toBeInTheDocument();
  });

  it("shimmers only the 8 table rows (the chrome stays real)", () => {
    const { container } = render(<Loading />);
    for (const header of ["User", "Contact", "Role", "Status"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    // The row cells still carry plenty of shimmer bars.
    expect(screen.getAllByTestId("sk").length).toBeGreaterThan(40);
  });
});
