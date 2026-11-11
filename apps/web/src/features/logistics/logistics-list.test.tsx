import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogisticsRow } from "./logistics-views";

// Stateful URL mock: push/replace update the params AND re-render subscribers,
// so URL-driven open/close (run drawer / customer modal) works in the test.
let sp = new URLSearchParams();
const listeners = new Set<() => void>();
const setUrl = (u: string) => {
  sp = new URLSearchParams(u.includes("?") ? u.slice(u.indexOf("?") + 1) : "");
  listeners.forEach((l) => l());
};
vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      listeners.add(force);
      return () => { listeners.delete(force); };
    }, []);
    return sp;
  },
  useRouter: () => ({ push: setUrl, replace: setUrl }),
  usePathname: () => "/logistics",
}));

vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./logistics-table", () => ({
  LogisticsTable: ({ view, onRowClick }: { readonly view: string; readonly onRowClick: (r: LogisticsRow) => void }) => (
    <div>
      <span>view:{view}</span>
      <button onClick={() => onRowClick({ runId: "r1" } as LogisticsRow)}>click-run</button>
      <button onClick={() => onRowClick({ customerId: "c1" } as LogisticsRow)}>click-cust</button>
    </div>
  ),
}));
vi.mock("./logistics-run-drawer", () => ({
  LogisticsRunDrawer: ({ openId, onClose }: { readonly openId: string | null; readonly onClose: () => void }) =>
    openId ? <div>run:{openId}<button onClick={onClose}>close-run</button></div> : null,
}));
vi.mock("./logistics-detail-modal", () => ({
  LogisticsDetailModal: ({ openId, onClose }: { readonly openId: string | null; readonly onClose: () => void }) =>
    openId ? <div>cust:{openId}<button onClick={onClose}>close-cust</button></div> : null,
}));

import { LogisticsList } from "./logistics-list";

const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => { sp = new URLSearchParams(); });

describe("LogisticsList", () => {
  it("defaults to the Runs view", () => {
    render(<LogisticsList role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("view:runs")).toBeInTheDocument();
  });

  it("opens the run drawer when a run row is clicked", () => {
    render(<LogisticsList role="SUPER_ADMIN" actionConfig={config} />);
    fireEvent.click(screen.getByText("click-run"));
    expect(screen.getByText("run:r1")).toBeInTheDocument();
  });

  it("opens the customer modal when a customer row is clicked", () => {
    render(<LogisticsList role="MANAGER" actionConfig={config} />);
    fireEvent.click(screen.getByText("click-cust"));
    expect(screen.getByText("cust:c1")).toBeInTheDocument();
  });

  it("closes the run drawer and customer modal via their onClose", () => {
    render(<LogisticsList role="SUPER_ADMIN" actionConfig={config} />);
    fireEvent.click(screen.getByText("click-run"));
    fireEvent.click(screen.getByText("close-run"));
    expect(screen.queryByText("run:r1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("click-cust"));
    fireEvent.click(screen.getByText("close-cust"));
    expect(screen.queryByText("cust:c1")).not.toBeInTheDocument();
  });
});
