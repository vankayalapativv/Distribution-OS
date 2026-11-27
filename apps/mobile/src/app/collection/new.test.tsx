import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

let params: Record<string, unknown> = { customerId: "c1", customerName: "Acme" };
const { back } = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("expo-router", () => ({ router: { back }, useLocalSearchParams: () => params }));
const useCollectionForm = vi.fn();
vi.mock("../../lib/collection/use-collection-form", () => ({ useCollectionForm: (...a: unknown[]) => useCollectionForm(...a) }));
vi.mock("../../lib/theme", () => ({ usePlaceholderColor: () => "#999" }));
vi.mock("../../lib/use-bottom-inset", () => ({ useBottomInset: () => 12 }));
vi.mock("../../components/collection/confirmation", () => ({ CollectionConfirmation: ({ code }: { code: string }) => <span>confirm-{code}</span> }));
vi.mock("../../components/collection/type-toggle", () => ({ CollectionTypeToggle: () => <span>type-toggle</span> }));
vi.mock("../../components/collection/amount-field", () => ({ AmountField: () => null }));
vi.mock("../../components/collection/mode-chips", () => ({ ModeChips: () => null }));
vi.mock("../../components/collection/reference-field", () => ({ ReferenceField: () => null }));
vi.mock("../../components/collection/proof-field", () => ({ ProofField: ({ onRemove }: { onRemove: () => void }) => <button type="button" onClick={onRemove}>proof-remove</button> }));
vi.mock("../../components/collection/record-button", () => ({ RecordButton: ({ onPress }: { onPress: () => void }) => <button type="button" onClick={onPress}>record</button> }));
vi.mock("../../components/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <span>err-{message}</span> }));

import NewCollectionScreen from "./new";

const form = (over: Record<string, unknown> = {}) =>
  ({ confirmedCode: null, queued: false, amountNum: 0, mode: "cash", collectionType: "payment", reset: vi.fn(),
    amount: "", setAmount: vi.fn(), setMode: vi.fn(), setCollectionType: vi.fn(), reference: "", setReference: vi.fn(),
    bankName: "", setBankName: vi.fn(), photo: null, preparing: 0, submitting: false, addPhoto: vi.fn(), setPhoto: vi.fn(),
    submitError: null, canSubmit: true, status: "idle", onSubmit: vi.fn(), ...over });

describe("NewCollectionScreen", () => {
  it("renders the form, records, and navigates back", () => {
    back.mockClear();
    const onSubmit = vi.fn();
    useCollectionForm.mockReturnValue(form({ onSubmit, submitError: "Amount required" }));
    render(<NewCollectionScreen />);
    expect(screen.getByText("type-toggle")).toBeInTheDocument();
    expect(screen.getByText("err-Amount required")).toBeInTheDocument();
    fireEvent.click(screen.getByText("record"));
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText("proof-remove"));
    fireEvent.click(screen.getByText("‹"));
    expect(back).toHaveBeenCalled();
  });

  it("shows the confirmation once recorded", () => {
    useCollectionForm.mockReturnValue(form({ confirmedCode: "RCP-9" }));
    render(<NewCollectionScreen />);
    expect(screen.getByText("confirm-RCP-9")).toBeInTheDocument();
  });

  it("shows the queued confirmation (code falls back to empty)", () => {
    useCollectionForm.mockReturnValue(form({ confirmedCode: null, queued: true }));
    render(<NewCollectionScreen />);
    expect(screen.getByText("confirm-")).toBeInTheDocument();
  });

  it("omits the customer subtitle when no name is passed", () => {
    params = { customerId: "c1" };
    useCollectionForm.mockReturnValue(form());
    render(<NewCollectionScreen />);
    expect(screen.getByText("Record collection")).toBeInTheDocument();
    params = { customerId: "c1", customerName: "Acme" };
  });
});
