/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: (p: any) => <div data-role={p.role}>{p.children}</div> }));
vi.mock("@/components/page-header", () => ({ PageHeader: (p: any) => <h1>{p.title}</h1> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <span data-testid="sk" /> }));
vi.mock("@/features/reassign/reassign-list-row-skeleton", () => ({ ReassignListRowSkeleton: () => <div data-testid="row-sk" /> }));
vi.mock("@/features/reassign/reassign-detail-skeleton", () => ({ ReassignDetailSkeleton: () => <div>detail-sk</div> }));

import Loading from "./loading";

describe("Reassign Loading", () => {
  it("mirrors the workbench: shell, header, 8 list-row skeletons + the detail skeleton", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector("[data-role]")).toHaveAttribute("data-role", "SUPER_ADMIN");
    expect(screen.getByRole("heading", { name: "Reassign Customers" })).toBeInTheDocument();
    expect(screen.getAllByTestId("row-sk")).toHaveLength(8);
    expect(screen.getByText("detail-sk")).toBeInTheDocument();
  });
});
