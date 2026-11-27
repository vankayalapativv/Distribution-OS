import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useNoOutcomeReason } from "./no-outcome-sheet";
import { NoOutcomeDialog, letterCount } from "./no-outcome-dialog";

type Sheet = { props: { visible: boolean; value: string; onChange: (t: string) => void; onCancel: () => void; onSubmit: () => void } };

describe("letterCount", () => {
  it("counts only letters", () => {
    expect(letterCount("ab-12 cд")).toBe(4);
  });
});

describe("useNoOutcomeReason", () => {
  it("resolves the trimmed reason once it has enough letters", async () => {
    const { result } = renderHook(() => useNoOutcomeReason());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.promptReason();
    });
    expect((result.current.sheet as unknown as Sheet).props.visible).toBe(true);
    act(() => (result.current.sheet as unknown as Sheet).props.onChange("  Shop closed  "));
    act(() => (result.current.sheet as unknown as Sheet).props.onSubmit());
    await expect(promise).resolves.toBe("Shop closed");
  });

  it("ignores a submit that is too short, then cancels to null", async () => {
    const { result } = renderHook(() => useNoOutcomeReason());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.promptReason();
    });
    act(() => (result.current.sheet as unknown as Sheet).props.onChange("hi"));
    act(() => (result.current.sheet as unknown as Sheet).props.onSubmit()); // < 5 letters → no resolve
    act(() => (result.current.sheet as unknown as Sheet).props.onCancel());
    await expect(promise).resolves.toBeNull();
  });
});

describe("NoOutcomeDialog", () => {
  it("nags and disables Check out below the minimum, then submits when valid", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <NoOutcomeDialog visible value="hi" onChange={vi.fn()} onCancel={vi.fn()} onSubmit={onSubmit} />,
    );
    expect(screen.getByText(/Please enter at least/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Check out"));
    expect(onSubmit).not.toHaveBeenCalled(); // disabled below minimum
    rerender(<NoOutcomeDialog visible value="Shop closed" onChange={vi.fn()} onCancel={onSubmit} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Check out"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows no hint when empty and cancels", () => {
    const onCancel = vi.fn();
    render(<NoOutcomeDialog visible value="" onChange={vi.fn()} onCancel={onCancel} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/Please enter at least/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("edits the reason text", () => {
    const onChange = vi.fn();
    render(<NoOutcomeDialog visible value="" onChange={onChange} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Shop closed/), { target: { value: "Owner away" } });
    expect(onChange).toHaveBeenCalledWith("Owner away");
  });
});
