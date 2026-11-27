import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AmountField } from "./amount-field";
import { ReferenceField } from "./reference-field";
import { CollectionTypeToggle } from "./type-toggle";
import { RecordButton } from "./record-button";

describe("AmountField", () => {
  it("edits the amount", () => {
    const onChange = vi.fn();
    render(<AmountField value="" onChange={onChange} placeholderColor="#999" />);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "500" } });
    expect(onChange).toHaveBeenCalledWith("500");
  });
});

describe("ReferenceField", () => {
  it("adapts the placeholder + shows a bank field only for cheque", () => {
    const onRef = vi.fn();
    const { rerender } = render(
      <ReferenceField mode="upi" reference="" onReference={onRef} bankName="" onBankName={() => {}} placeholderColor="#999" />,
    );
    expect(screen.getByPlaceholderText(/UTR/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Bank name/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/UTR/), { target: { value: "UTR9" } });
    expect(onRef).toHaveBeenCalledWith("UTR9");
    rerender(
      <ReferenceField mode="cheque" reference="" onReference={onRef} bankName="" onBankName={() => {}} placeholderColor="#999" />,
    );
    expect(screen.getByPlaceholderText("Cheque no.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Bank name/)).toBeInTheDocument();
    rerender(
      <ReferenceField mode="cash" reference="" onReference={onRef} bankName="" onBankName={() => {}} placeholderColor="#999" />,
    );
    expect(screen.getByPlaceholderText(/Receipt no/)).toBeInTheDocument();
  });
});

describe("CollectionTypeToggle", () => {
  it("toggles between general and advance, showing the advance note", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CollectionTypeToggle value="general" onChange={onChange} />);
    expect(screen.queryByText(/oldest dues first/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Advance"));
    expect(onChange).toHaveBeenCalledWith("advance");
    rerender(<CollectionTypeToggle value="advance" onChange={onChange} />);
    expect(screen.getByText(/oldest dues first/)).toBeInTheDocument();
  });
});

describe("RecordButton", () => {
  it("shows the amount label when idle and fires onPress", () => {
    const onPress = vi.fn();
    render(<RecordButton canSubmit submitting={false} status="" amountNum={500} onPress={onPress} />);
    fireEvent.click(screen.getByText(/Record ₹500/));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the generic label at zero amount, and the status while submitting (disabled)", () => {
    const onPress = vi.fn();
    const { rerender } = render(<RecordButton canSubmit submitting={false} status="" amountNum={0} onPress={onPress} />);
    expect(screen.getByText(/Record collection/)).toBeInTheDocument();
    rerender(<RecordButton canSubmit submitting status="Uploading receipt…" amountNum={500} onPress={onPress} />);
    expect(screen.getByText("Uploading receipt…")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Uploading receipt…"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
