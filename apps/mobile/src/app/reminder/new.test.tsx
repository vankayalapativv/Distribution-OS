import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useReminderForm = vi.fn();
const saveReminder = vi.fn();
vi.mock("../../components/reminders/use-reminder-form", () => ({ useReminderForm: () => useReminderForm() }));
vi.mock("../../components/reminders/save-reminder", () => ({ saveReminder: (...a: unknown[]) => saveReminder(...a) }));
vi.mock("../../components/dialog", () => ({ useDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../lib/theme", () => ({ usePlaceholderColor: () => "#999" }));
vi.mock("../../lib/use-bottom-inset", () => ({ useBottomInset: () => 12 }));
vi.mock("../../components/reminders/when-field", () => ({ WhenField: () => <span>when-field</span> }));
vi.mock("../../components/reminders/customer-picker", () => ({ CustomerPicker: ({ clearError }: { clearError: () => void }) => <button type="button" onClick={clearError}>picker</button> }));
vi.mock("../../components/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <span>err-{message}</span> }));

import NewReminderScreen from "./new";

const form = (over: Record<string, unknown> = {}) =>
  ({ editId: null, title: "", setTitle: vi.fn(), error: null, setError: vi.fn(), busy: false,
    when: new Date(), whenLabel: "soon", showDate: false, showTime: false, setShowDate: vi.fn(), setShowTime: vi.fn(), setWhen: vi.fn(),
    customer: null, customerSearch: "", trimmedSearch: "", filteredCustomers: [], customersQuery: { isPending: false }, setCustomer: vi.fn(), setCustomerSearch: vi.fn(), ...over });

describe("NewReminderScreen", () => {
  it("creates a new reminder (edits title, clears error, saves, back)", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    const setTitle = vi.fn();
    const setError = vi.fn();
    useReminderForm.mockReturnValue(form({ setTitle, setError, error: "Required" }));
    render(<NewReminderScreen />);
    expect(screen.getByText("New reminder")).toBeInTheDocument();
    expect(screen.getByText("err-Required")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("e.g. Collect payment"), { target: { value: "Pay" } });
    expect(setTitle).toHaveBeenCalledWith("Pay");
    expect(setError).toHaveBeenCalledWith(null); // error present → cleared on type
    fireEvent.click(screen.getByText("picker")); // CustomerPicker clearError
    fireEvent.click(screen.getByText("Set reminder"));
    expect(saveReminder).toHaveBeenCalled();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("renders the edit variant (Save changes) and ignores the no-error type path", () => {
    const setError = vi.fn();
    useReminderForm.mockReturnValue(form({ editId: 7, busy: false, error: null, setError }));
    render(<NewReminderScreen />);
    expect(screen.getByText("Edit reminder")).toBeInTheDocument();
    expect(screen.getByText("Save changes")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("e.g. Collect payment"), { target: { value: "x" } });
    expect(setError).not.toHaveBeenCalled(); // no error → nothing to clear
  });

  it("shows a busy spinner instead of the save label", () => {
    useReminderForm.mockReturnValue(form({ editId: 7, busy: true }));
    render(<NewReminderScreen />);
    expect(screen.queryByText("Save changes")).not.toBeInTheDocument();
  });
});
