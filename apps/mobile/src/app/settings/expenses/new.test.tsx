import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const form = vi.fn();
vi.mock("../../../lib/use-claim-form", () => ({ useClaimForm: () => form() }));
vi.mock("expo-router", () => ({ router: { back: vi.fn() } }));
vi.mock("../../../components/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <span>err:{message}</span> }));

import { router } from "expo-router";
import NewExpenseScreen from "./new";

const base = {
  editId: null as string | null,
  editStatus: null as "submitted" | "approved" | "rejected" | null,
  categories: [{ id: "c1", name: "Fuel" }],
  categoriesLoading: false,
  categoryId: null as string | null,
  setCategoryId: vi.fn(),
  amount: "",
  setAmount: vi.fn(),
  date: "2026-11-28",
  setDate: vi.fn(),
  remarks: "",
  setRemarks: vi.fn(),
  receiptUri: null as string | null,
  pickReceipt: vi.fn(),
  error: null as string | null,
  busy: false,
  save: vi.fn(),
};
beforeEach(() => { vi.clearAllMocks(); form.mockReturnValue({ ...base }); });

describe("NewExpenseScreen", () => {
  it("renders the new-claim form and picks a category", () => {
    render(<NewExpenseScreen />);
    expect(screen.getByText("New expense")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Fuel"));
    expect(base.setCategoryId).toHaveBeenCalledWith("c1");
  });

  it("types an amount and submits", () => {
    render(<NewExpenseScreen />);
    fireEvent.change(screen.getByPlaceholderText("₹ 0"), { target: { value: "450" } });
    expect(base.setAmount).toHaveBeenCalledWith("450");
    fireEvent.click(screen.getByText("Submit for approval"));
    expect(base.save).toHaveBeenCalled();
  });

  it("shows the receipt pickers and captures one", () => {
    render(<NewExpenseScreen />);
    fireEvent.click(screen.getByText("📷 Camera"));
    expect(base.pickReceipt).toHaveBeenCalledWith("camera");
    fireEvent.click(screen.getByText("🖼 Gallery"));
    expect(base.pickReceipt).toHaveBeenCalledWith("gallery");
  });

  it("shows the receipt preview + retake once captured, and goes back", () => {
    form.mockReturnValue({ ...base, receiptUri: "file:///r.jpg" });
    render(<NewExpenseScreen />);
    expect(screen.queryByText("📷 Camera")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Retake"));
    expect(base.pickReceipt).toHaveBeenCalledWith("camera");
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a spinner while busy + surfaces errors", () => {
    form.mockReturnValue({ ...base, busy: true, error: "network down" });
    render(<NewExpenseScreen />);
    expect(screen.queryByText("Submit for approval")).not.toBeInTheDocument();
    expect(screen.getByText("err:network down")).toBeInTheDocument();
  });

  it("edit mode shows an optional replace-receipt section; a rejected claim says Resubmit", () => {
    form.mockReturnValue({ ...base, editId: "r1", editStatus: "rejected" });
    render(<NewExpenseScreen />);
    expect(screen.getByText("Edit & resubmit")).toBeInTheDocument();
    expect(screen.getByText("Resubmit")).toBeInTheDocument();
    expect(screen.getByText("Replace receipt (optional)")).toBeInTheDocument();
    expect(screen.getByText("📷 Camera")).toBeInTheDocument();
    expect(screen.getByText(/Keep the attached receipt/)).toBeInTheDocument();
  });

  it("a still-pending claim edits with Save changes", () => {
    form.mockReturnValue({ ...base, editId: "s1", editStatus: "submitted" });
    render(<NewExpenseScreen />);
    expect(screen.getByText("Edit expense")).toBeInTheDocument();
    expect(screen.getByText("Save changes")).toBeInTheDocument();
  });

  it("shows a spinner while categories load", () => {
    form.mockReturnValue({ ...base, categoriesLoading: true });
    render(<NewExpenseScreen />);
    expect(screen.queryByText("Fuel")).not.toBeInTheDocument();
  });

  it("highlights the selected category", () => {
    form.mockReturnValue({ ...base, categoryId: "c1" });
    render(<NewExpenseScreen />);
    expect(screen.getByText("Fuel")).toBeInTheDocument();
  });
});
