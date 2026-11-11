import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/data-table/query-provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withQueryClient: (C: any) => C,
}));
vi.mock("@/features/shell/dashboard-shell", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DashboardShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/page-header", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageHeader: ({ subtitle }: any) => <p>{subtitle}</p>,
}));
// Stateful useUrlParam stand-in: a real React state so the tab toggles on click.
vi.mock("@/lib/use-url-state", async () => {
  const { useState } = await import("react");
  return {
    useUrlParam: (_key: string, opts?: { defaultValue?: string }) => {
      const [v, setV] = useState(opts?.defaultValue ?? "");
      return [v, (next: string | null) => setV(next ?? "")] as const;
    },
  };
});
vi.mock("./attendance-grid", () => ({ AttendanceGrid: () => <div>GRID</div> }));
vi.mock("./attendance-daily", () => ({ AttendanceDaily: () => <div>DAILY</div> }));

import { AttendanceView } from "./attendance-view";

const config = { apiBaseUrl: "", authToken: "" };

describe("AttendanceView", () => {
  it("defaults to the Monthly grid and switches to Daily", () => {
    render(<AttendanceView role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("GRID")).toBeInTheDocument();
    expect(screen.queryByText("DAILY")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    expect(screen.getByText("DAILY")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("GRID")).toBeInTheDocument();
  });

  it("shows the editable subtitle for a Super Admin and the read-only one otherwise", () => {
    const { rerender } = render(<AttendanceView role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText(/click any cell/)).toBeInTheDocument();
    rerender(<AttendanceView role="MANAGER" actionConfig={config} />);
    expect(screen.getByText(/pre-filled from GPS day tracking\.$/)).toBeInTheDocument();
  });
});
