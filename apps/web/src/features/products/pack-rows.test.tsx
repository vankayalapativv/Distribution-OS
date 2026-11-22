import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackRows } from "./pack-rows";

const field = () => screen.getByPlaceholderText(/Add a pack in litres/);

describe("PackRows", () => {
  it("adds a pack via the Add button and keeps sizes sorted", () => {
    const onChange = vi.fn();
    render(<PackRows packs={[{ packSize: 5 }]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith([{ packSize: 1 }, { packSize: 5 }]);
  });

  it("adds on Enter and clears the input", () => {
    const onChange = vi.fn();
    render(<PackRows packs={[]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: "0.5" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([{ packSize: 0.5 }]);
    expect((field() as HTMLInputElement).value).toBe("");
  });

  it("ignores a non-positive size and a duplicate", () => {
    const onChange = vi.fn();
    render(<PackRows packs={[{ packSize: 5 }]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(field(), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders existing packs and removes one", () => {
    const onChange = vi.fn();
    render(<PackRows packs={[{ packSize: 1 }, { packSize: 5 }]} onChange={onChange} />);
    expect(screen.getByText("1 L")).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("Remove pack")[0]);
    expect(onChange).toHaveBeenCalledWith([{ packSize: 5 }]);
  });

  it("does not add when the non-Enter key is pressed", () => {
    const onChange = vi.fn();
    render(<PackRows packs={[]} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: "2" } });
    fireEvent.keyDown(field(), { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
