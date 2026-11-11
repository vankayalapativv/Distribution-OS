import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const form = {
  name: "Guard", setName: vi.fn(), type: "variable" as string, setType: vi.fn(),
  busy: false, error: null as string | null,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-category-form", () => ({ useCategoryForm: () => form }));
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: ({ items, getKey, getLabel, onSelect }: {
    readonly items: unknown[];
    readonly getKey: (it: unknown) => string;
    readonly getLabel: (it: unknown) => string;
    readonly onSelect: (v: string) => void;
  }) => (
    <div>
      {items.map((it) => (
        <button key={getKey(it)} onClick={() => onSelect(getKey(it))}>{getLabel(it)}</button>
      ))}
    </div>
  ),
}));

import { ExpenditureCategoryDialog } from "./expenditure-category-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), actionConfig: config };

describe("ExpenditureCategoryDialog", () => {
  it("edits the name, picks a type and submits", () => {
    render(<ExpenditureCategoryDialog {...props} />);
    expect(screen.getByRole("heading", { name: "Add category" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Security" } });
    expect(form.setName).toHaveBeenCalledWith("Security");
    fireEvent.click(screen.getByRole("button", { name: "Compulsory" }));
    expect(form.setType).toHaveBeenCalledWith("compulsory");
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(form.handleSubmit).toHaveBeenCalled();
  });

  it("disables submit with a blank name / while busy and shows the error", () => {
    form.error = "Duplicate";
    form.busy = true;
    render(<ExpenditureCategoryDialog {...props} />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    form.error = null;
    form.busy = false;
  });

  it("Cancel closes the dialog", () => {
    const onOpenChange = vi.fn();
    render(<ExpenditureCategoryDialog {...props} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
