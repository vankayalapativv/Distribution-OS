import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can: Record<string, boolean> = {};
vi.mock("@/features/shell/use-can", () => ({ useCan: (k: string) => can[k] ?? false }));
const claims = { claims: [] as unknown[] };
vi.mock("./use-claims-queue", () => ({ useClaimsQueue: () => claims }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ExpenditureActionsMenu } from "./expenditure-actions-menu";

const config = { apiBaseUrl: "", authToken: "" };
const ALL = {
  "action:expenditures.claims.approve": true,
  "action:expenditures.advances.manage": true,
  "action:expenditures.advances.approve": true,
  "action:salary.view": true,
  "action:expenditures.manage": true,
};
beforeEach(() => { vi.clearAllMocks(); Object.keys(can).forEach((k) => delete can[k]); claims.claims = []; });
afterEach(() => vi.clearAllMocks());

const openMenu = () => fireEvent.click(screen.getByTitle("Expense actions"));

describe("ExpenditureActionsMenu", () => {
  it("renders nothing when the user has no expense permissions", () => {
    const { container } = render(<ExpenditureActionsMenu actionConfig={config} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only permitted items, with a pending-claims badge", () => {
    Object.assign(can, { "action:expenditures.claims.approve": true, "action:salary.view": true });
    claims.claims = [1, 2, 3];
    render(<ExpenditureActionsMenu actionConfig={config} />);
    openMenu();
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // badge
    expect(screen.getByText("Salary & pay")).toBeInTheDocument();
    expect(screen.queryByText("Advances")).not.toBeInTheDocument();
    expect(screen.queryByText("Employee ledger")).not.toBeInTheDocument();
  });

  it("deep-links each item to the desk page at its tab", () => {
    Object.assign(can, ALL);
    render(<ExpenditureActionsMenu actionConfig={config} />);
    const go = (label: string, tab: string) => {
      openMenu();
      fireEvent.click(screen.getByText(label));
      expect(push).toHaveBeenLastCalledWith(`/expenditures/desk?tab=${tab}`);
    };
    go("Claims", "claims");
    go("Advances", "advances");
    go("Salary & pay", "salary");
    go("Employee ledger", "ledger");
  });

  it("shows Advances when the user can only approve requests, and no badge at zero", () => {
    Object.assign(can, { "action:expenditures.advances.approve": true });
    render(<ExpenditureActionsMenu actionConfig={config} />);
    openMenu();
    expect(screen.getByText("Advances")).toBeInTheDocument();
    expect(screen.queryByText("Claims")).not.toBeInTheDocument();
  });
});
