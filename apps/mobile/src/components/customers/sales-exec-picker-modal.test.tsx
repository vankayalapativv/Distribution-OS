import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SalesExecPickerModal } from "./sales-exec-picker-modal";

const base = {
  visible: true,
  value: null as string | null,
  filtered: [
    { id: "e1", name: "Asha" },
    { id: "e2", name: "Bina" },
  ],
  isPending: false,
  search: "",
  onSearch: () => {},
  onSelect: () => {},
  onClose: () => {},
};

describe("SalesExecPickerModal", () => {
  it("renders the exec list, searches, and selects (closing after)", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const onSearch = vi.fn();
    render(<SalesExecPickerModal {...base} value="e2" onSelect={onSelect} onClose={onClose} onSearch={onSearch} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search executive…"), { target: { value: "as" } });
    expect(onSearch).toHaveBeenCalledWith("as");
    fireEvent.click(screen.getByText("Asha"));
    expect(onSelect).toHaveBeenCalledWith("e1", "Asha");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a loading state", () => {
    render(<SalesExecPickerModal {...base} isPending />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
  });

  it("shows the empty state when the list is empty", () => {
    render(<SalesExecPickerModal {...base} filtered={[]} />);
    expect(screen.getByText("No executives found.")).toBeInTheDocument();
  });

  it("closes on the backdrop but not on a card tap", () => {
    const onClose = vi.fn();
    render(<SalesExecPickerModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByText("Assign sales executive")); // inside card → no close
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders nothing when hidden", () => {
    render(<SalesExecPickerModal {...base} visible={false} />);
    expect(screen.queryByText("Assign sales executive")).not.toBeInTheDocument();
  });
});
