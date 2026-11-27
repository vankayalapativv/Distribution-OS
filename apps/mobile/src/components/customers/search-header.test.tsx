import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { SearchHeader } from "./search-header";

describe("SearchHeader", () => {
  it("types, clears, and opens the new-customer screen", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    const onChange = vi.fn();
    render(<SearchHeader search="acme" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "beta" } });
    expect(onChange).toHaveBeenCalledWith("beta");
    fireEvent.click(screen.getByText("✕")); // clear (search is non-empty)
    expect(onChange).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByText("+ Add"));
    expect(router.push).toHaveBeenCalledWith("/customer/new");
  });

  it("hides the clear control when the search is blank", () => {
    render(<SearchHeader search="  " onChange={() => {}} />);
    expect(screen.queryByText("✕")).not.toBeInTheDocument();
  });
});
