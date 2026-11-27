import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ModeChips } from "./mode-chips";
import { PAYMENT_MODES } from "../../lib/collection/constants";

describe("ModeChips", () => {
  it("renders every payment mode and selects one", () => {
    const onChange = vi.fn();
    render(<ModeChips value={PAYMENT_MODES[0].key} onChange={onChange} />);
    for (const m of PAYMENT_MODES) expect(screen.getByText(m.label)).toBeInTheDocument();
    const other = PAYMENT_MODES[1];
    fireEvent.click(screen.getByText(other.label));
    expect(onChange).toHaveBeenCalledWith(other.key);
  });
});
