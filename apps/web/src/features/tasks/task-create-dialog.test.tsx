import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Function declaration (hoisted) so the hoisted vi.mock factories can reference it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pass({ children }: any) { return <div>{children}</div>; }
vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Dialog: ({ children, onOpenChange }: any) => <div><button onClick={() => onOpenChange(false)}>dlg-dismiss</button>{children}</div>,
  DialogBody: pass, DialogContent: pass, DialogFooter: pass, DialogHeader: pass, DialogTitle: pass,
}));
vi.mock("@/components/ui/label", () => ({ Label: pass }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@/components/ui/textarea", () => ({ Textarea: ({ onChange }: any) => <textarea aria-label="Description" onChange={onChange} /> }));
vi.mock("@/components/form/text-field", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TextField: ({ onChange }: any) => <input aria-label="Title" onChange={onChange} />,
}));
vi.mock("@/features/expenditures/expenditure-date-picker", () => ({ DatePicker: () => <div data-testid="due-date" /> }));
vi.mock("@/components/ui/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ onSelect }: any) => <button onClick={() => onSelect("high")}>pick-high</button>,
}));
vi.mock("./task-assignee-select", () => ({ TaskAssigneeSelect: () => <div data-testid="assignee" /> }));
vi.mock("./task-reminder-block", () => ({ TaskReminderBlock: () => <div data-testid="reminder" /> }));
vi.mock("./task-customer-select", () => ({ TaskCustomerSelect: () => <div data-testid="customer" /> }));

const hook = {
  title: "", setTitle: vi.fn(), description: "", setDescription: vi.fn(), priority: "medium", setPriority: vi.fn(),
  dueDate: "", setDueDate: vi.fn(), time: "", setTime: vi.fn(), assignee: "", setAssignee: vi.fn(),
  customer: "", setCustomer: vi.fn(), creating: false, officeAssignees: [], seAssignees: [],
  selectedAssignee: null, assigneeIsSe: false, selectedCustomer: null, remindPreview: null, canSubmit: true, handleCreate: vi.fn(),
};
vi.mock("./use-task-create", () => ({ useTaskCreate: () => hook }));

import { TaskCreateDialog } from "./task-create-dialog";

const props = { assignees: [], customers: [], actionConfig: { apiBaseUrl: "", authToken: "", currentUserId: "me" }, onCreated: vi.fn(), onError: vi.fn(), onClose: vi.fn() };

describe("TaskCreateDialog", () => {
  it("edits the title + priority and shows the office due-date field", () => {
    render(<TaskCreateDialog {...props} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Call" } });
    fireEvent.click(screen.getByText("pick-high"));
    expect(hook.setTitle).toHaveBeenCalled();
    expect(hook.setPriority).toHaveBeenCalledWith("high");
    expect(screen.getByTestId("due-date")).toBeInTheDocument();
    expect(screen.queryByTestId("reminder")).not.toBeInTheDocument();
  });

  it("swaps the due-date for the SE reminder block", () => {
    hook.assigneeIsSe = true;
    render(<TaskCreateDialog {...props} />);
    expect(screen.getByTestId("reminder")).toBeInTheDocument();
    expect(screen.queryByTestId("due-date")).not.toBeInTheDocument();
    hook.assigneeIsSe = false;
  });

  it("edits the description", () => {
    render(<TaskCreateDialog {...props} />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "note" } });
    expect(hook.setDescription).toHaveBeenCalled();
  });

  it("creates, cancels, and closes when the dialog is dismissed", () => {
    const onClose = vi.fn();
    render(<TaskCreateDialog {...props} onClose={onClose} />);
    fireEvent.click(screen.getByText("Create task"));
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("dlg-dismiss"));
    expect(hook.handleCreate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2); // Cancel + dialog dismiss
  });

  it("disables submit and shows Creating… while busy", () => {
    hook.creating = true;
    hook.canSubmit = false;
    render(<TaskCreateDialog {...props} />);
    expect(screen.getByText("Creating…")).toBeDisabled();
    hook.creating = false;
    hook.canSubmit = true;
  });
});
