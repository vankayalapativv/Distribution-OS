import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Advance, AdvanceBalance } from "./advances-api";

const can = { manage: true, approve: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: (k: string) => (k.includes("manage") ? can.manage : can.approve) }));
const data = {
  requests: [] as Advance[], balances: [] as AdvanceBalance[], outstandingTotal: 0, isLoading: false,
  approve: vi.fn(() => Promise.resolve()), reject: vi.fn(() => Promise.resolve()), record: vi.fn(() => Promise.resolve()),
};
vi.mock("./use-advances", () => ({ useAdvances: () => data }));
vi.mock("./use-expenditure-lookups", () => ({ useExpenditureLookups: () => ({ people: [{ id: "u1", name: "Priya" }] }) }));
vi.mock("./advance-decision-dialog", () => ({
  AdvanceDecisionDialog: ({ decision, onOpenChange, onApprove, onReject }: { decision: { mode: string; advance: { id: string } } | null; onOpenChange: (o: boolean) => void; onApprove: (id: string, p: unknown) => Promise<void>; onReject: (id: string, r: string) => Promise<void> }) =>
    decision ? <div>DEC:{decision.mode}:{decision.advance.id}<button onClick={() => void onApprove(decision.advance.id, {})}>a</button><button onClick={() => void onReject(decision.advance.id, "r")}>r</button><button onClick={() => onOpenChange(false)}>close-dec</button></div> : null,
}));
vi.mock("./record-advance-dialog", () => ({
  RecordAdvanceDialog: ({ open, onOpenChange, onRecord }: { open: boolean; onOpenChange: (o: boolean) => void; onRecord: (i: unknown) => Promise<void> }) =>
    open ? <div>RECORD<button onClick={() => void onRecord({})}>do-record</button><button onClick={() => onOpenChange(false)}>close-rec</button></div> : null,
}));

import { AdvancesPanel } from "./advances-panel";

const adv = (over: Partial<Advance> = {}): Advance => ({
  id: "a1", userId: "u1", userName: "Priya", amount: 10000, source: "request", status: "requested",
  recoveryPlan: null, installmentAmount: null, outstanding: 0, reason: "medical", rejectReason: null, approvedAt: null, createdAt: "2026-11-28", ...over,
});
const config = { apiBaseUrl: "", authToken: "" };
const renderPanel = () => render(<AdvancesPanel actionConfig={config} />);

beforeEach(() => {
  vi.clearAllMocks();
  can.manage = true; can.approve = true; data.isLoading = false;
  data.requests = [adv()]; data.balances = [{ userId: "u2", userName: "Ravi", outstanding: 8000 }]; data.outstandingTotal = 8000;
});
afterEach(() => vi.clearAllMocks());

describe("AdvancesPanel", () => {
  it("shows an all-clear note with no permission and nothing to show", () => {
    can.manage = false; can.approve = false; data.requests = []; data.balances = [];
    renderPanel();
    expect(screen.getByText("No advances outstanding")).toBeInTheDocument();
    expect(screen.queryByText("Record advance")).not.toBeInTheDocument();
  });

  it("shimmers while loading", () => {
    data.isLoading = true;
    renderPanel();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("shows requests, balances, the Record button, and opens dialogs", () => {
    renderPanel();
    expect(screen.getByText(/₹8,000 outstanding across 1/)).toBeInTheDocument();
    expect(screen.getByText(/Priya · ₹10,000/)).toBeInTheDocument();
    expect(screen.getByText(/Ravi/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Approve"));
    expect(screen.getByText("DEC:approve:a1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("a"));
    expect(data.approve).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Reject"));
    expect(screen.getByText("DEC:reject:a1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close-dec"));
    expect(screen.queryByText(/^DEC/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Record advance"));
    expect(screen.getByText("RECORD")).toBeInTheDocument();
    fireEvent.click(screen.getByText("do-record"));
    expect(data.record).toHaveBeenCalled();
    fireEvent.click(screen.getByText("close-rec"));
    expect(screen.queryByText("RECORD")).not.toBeInTheDocument();
  });

  it("hides requests when the user can't approve, but still shows balances", () => {
    can.approve = false; can.manage = false;
    renderPanel();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.getByText(/Ravi/)).toBeInTheDocument(); // balances keep the panel visible
    expect(screen.queryByText("Record advance")).not.toBeInTheDocument(); // no manage perm
  });

  it("shows the no-advances note and a reject reason fallback when there are no balances", () => {
    data.balances = []; data.requests = [adv({ reason: null })];
    renderPanel();
    expect(screen.getByText("No advances outstanding")).toBeInTheDocument();
    expect(screen.getByText(/no reason given/)).toBeInTheDocument();
  });

  it("falls back to a dash for unknown names in requests and balances", () => {
    data.requests = [adv({ userName: null })];
    data.balances = [{ userId: null, userName: null, outstanding: 500 }];
    renderPanel();
    expect(screen.getAllByText(/—/).length).toBeGreaterThanOrEqual(2);
  });
});
