import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const p = { editing: null as unknown, period: "week", startStr: "2026-07-06", isFuture: false, clipboard: null, setClipboard: vi.fn(), setEditing: vi.fn() };
vi.mock("./use-targets-panel", () => ({ useTargetsPanel: () => p }));
vi.mock("@/components/data-table/query-provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withQueryClient: (C: any) => C,
}));
vi.mock("./targets-panel-header", () => ({ TargetsPanelHeader: () => <div>HEADER</div> }));
vi.mock("./targets-exec-list", () => ({ TargetsExecList: () => <div>LIST</div> }));
vi.mock("./paste-all-dialog", () => ({ PasteAllDialog: () => <div>PASTE_ALL</div> }));
vi.mock("./target-edit-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetEditDialog: ({ onClose, onCopy }: any) => (
    <div>EDIT_DIALOG<button onClick={onClose}>ed-close</button><button onClick={() => onCopy("v")}>ed-copy</button></div>
  ),
}));

import { TargetsPanel } from "./targets-panel";

const config = { apiBaseUrl: "", authToken: "" };

describe("TargetsPanel", () => {
  it("renders header + list + paste-all, and no edit dialog when nothing is being edited", () => {
    render(<TargetsPanel actionConfig={config} />);
    expect(screen.getByText("HEADER")).toBeInTheDocument();
    expect(screen.getByText("LIST")).toBeInTheDocument();
    expect(screen.getByText("PASTE_ALL")).toBeInTheDocument();
    expect(screen.queryByText("EDIT_DIALOG")).not.toBeInTheDocument();
  });

  it("shows the edit dialog when an executive is being edited", () => {
    p.editing = { userId: "u1" };
    render(<TargetsPanel actionConfig={config} />);
    expect(screen.getByText("EDIT_DIALOG")).toBeInTheDocument();
    fireEvent.click(screen.getByText("ed-close"));
    expect(p.setEditing).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("ed-copy"));
    expect(p.setClipboard).toHaveBeenCalledWith("v");
    p.editing = null;
  });
});
