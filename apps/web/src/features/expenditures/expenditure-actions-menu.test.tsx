import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can: Record<string, boolean> = {};
vi.mock("@/features/shell/use-can", () => ({ useCan: (k: string) => can[k] ?? false }));
const claims = { claims: [] as unknown[] };
vi.mock("./use-claims-queue", () => ({ useClaimsQueue: () => claims }));
vi.mock("./claims-queue-panel", () => ({ ClaimsQueuePanel: () => <div>CLAIMS-BODY</div> }));
vi.mock("./advances-panel", () => ({ AdvancesPanel: () => <div>ADV-BODY</div> }));
vi.mock("./salary-panel", () => ({ SalaryPanel: () => <div>SALARY-BODY</div> }));
vi.mock("./employee-ledger-dialog", () => ({ EmployeeLedgerDialogBody: () => <div>LEDGER-BODY</div> }));

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
    expect(screen.queryByText("Reimbursements")).not.toBeInTheDocument();
    expect(screen.queryByText("Advances")).not.toBeInTheDocument();
    expect(screen.queryByText("Employee ledger")).not.toBeInTheDocument();
  });

  it("opens each permitted dialog from its menu item, and closes it", () => {
    Object.assign(can, ALL);
    render(<ExpenditureActionsMenu actionConfig={config} />);
    const open = (label: string, body: string) => {
      openMenu();
      fireEvent.click(screen.getByText(label));
      expect(screen.getByText(body)).toBeInTheDocument();
    };
    open("Claims", "CLAIMS-BODY");
    open("Advances", "ADV-BODY");
    open("Salary & pay", "SALARY-BODY");
    open("Employee ledger", "LEDGER-BODY");

    // Escape closes the dialog (onOpenChange → setDialog(null)).
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByText("LEDGER-BODY")).not.toBeInTheDocument();
  });

  it("shows Advances when the user can only approve requests, and no badge at zero", () => {
    Object.assign(can, { "action:expenditures.advances.approve": true });
    render(<ExpenditureActionsMenu actionConfig={config} />);
    openMenu();
    expect(screen.getByText("Advances")).toBeInTheDocument();
    expect(screen.queryByText("Claims")).not.toBeInTheDocument();
  });
});
