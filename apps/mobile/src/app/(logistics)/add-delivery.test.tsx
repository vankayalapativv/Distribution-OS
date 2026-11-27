import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { router } from "expo-router";

const pickerProps: Array<Record<string, unknown>> = [];
const confirmProps: Array<Record<string, unknown>> = [];
vi.mock("../../components/delivery/invoice-picker", () => ({ InvoicePicker: (p: Record<string, unknown>) => { pickerProps.push(p); return null; } }));
vi.mock("../../components/delivery/delivery-confirm", () => ({ DeliveryConfirm: (p: Record<string, unknown>) => { confirmProps.push(p); return null; } }));

const useAuth = vi.fn();
const useDeliverableInvoices = vi.fn();
const useSaveDeliveryStop = vi.fn();
const pickFromCamera = vi.fn();
const stampPhoto = vi.fn();
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => useAuth(sel) }));
vi.mock("../../lib/theme", () => ({ usePlaceholderColor: () => "#999" }));
vi.mock("../../lib/use-deliverable-invoices", () => ({ useDeliverableInvoices: (...a: unknown[]) => useDeliverableInvoices(...a) }));
vi.mock("../../lib/use-save-delivery-stop", () => ({ useSaveDeliveryStop: (...a: unknown[]) => useSaveDeliveryStop(...a) }));
vi.mock("../../lib/photos", () => ({ pickFromCamera: () => pickFromCamera() }));
vi.mock("../../lib/photo-stamp", () => ({ stampPhoto: (...a: unknown[]) => stampPhoto(...a) }));

import AddDeliveryScreen from "./add-delivery";

const lastPicker = () => pickerProps[pickerProps.length - 1];
const lastConfirm = () => confirmProps[confirmProps.length - 1];

function setup(saveOver: Record<string, unknown> = {}) {
  const setError = vi.fn();
  const reset = vi.fn();
  const refetch = vi.fn();
  const save = vi.fn(() => Promise.resolve(true));
  useAuth.mockImplementation((sel) => sel({ token: "t", user: { name: "Driver" } }));
  useDeliverableInvoices.mockReturnValue({
    invoicesQuery: { isPending: false, isError: false, error: null, isRefetching: false, refetch },
    filtered: [], search: "", setSearch: vi.fn(), reset,
  });
  useSaveDeliveryStop.mockReturnValue({ setError, busy: false, error: null, save, ...saveOver });
  return { setError, reset, refetch, save };
}

afterEach(() => { pickerProps.length = 0; confirmProps.length = 0; vi.clearAllMocks(); });

describe("AddDeliveryScreen", () => {
  it("picks an invoice, adds a stamped photo, removes it, saves and goes back", async () => {
    const h = setup();
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    stampPhoto.mockResolvedValue({ uri: "a-stamped" });
    render(<AddDeliveryScreen />);
    // invoice-picker wiring
    lastPicker().onRetry as () => void; (lastPicker().onRetry as () => void)();
    (lastPicker().onSearch as (s: string) => void)("acme");
    (lastPicker().onRefresh as () => void)();
    (lastPicker().onBack as () => void)();
    expect(router.back).toHaveBeenCalled();
    // pick → confirm screen
    act(() => (lastPicker().onPick as (i: unknown) => void)({ customerName: "Acme" }));
    await act(async () => { await (lastConfirm().onAddPhoto as () => Promise<void>)(); });
    expect(stampPhoto).toHaveBeenCalled();
    act(() => (lastConfirm().onRemovePhoto as (i: number) => void)(0));
    await act(async () => { await (lastConfirm().onSave as () => Promise<void>)(); });
    expect(h.save).toHaveBeenCalled();
    act(() => (lastConfirm().onBack as () => void)()); // back to the picker
    expect(pickerProps.length).toBeGreaterThan(1);
  });

  it("surfaces a camera error and bails on an empty capture", async () => {
    const h = setup();
    render(<AddDeliveryScreen />);
    act(() => (lastPicker().onPick as (i: unknown) => void)({ customerName: null }));
    pickFromCamera.mockResolvedValueOnce({ photos: [], error: "Camera denied" });
    await act(async () => { await (lastConfirm().onAddPhoto as () => Promise<void>)(); });
    expect(h.setError).toHaveBeenCalledWith("Camera denied");
    pickFromCamera.mockResolvedValueOnce({ photos: [], error: null }); // empty → no-op
    await act(async () => { await (lastConfirm().onAddPhoto as () => Promise<void>)(); });
  });

  it("catches an Error stamping failure", async () => {
    const h = setup();
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    stampPhoto.mockRejectedValue(new Error("stamp boom"));
    render(<AddDeliveryScreen />);
    act(() => (lastPicker().onPick as (i: unknown) => void)({ customerName: "Acme" }));
    await act(async () => { await (lastConfirm().onAddPhoto as () => Promise<void>)(); });
    expect(h.setError).toHaveBeenCalledWith("stamp boom");
  });

  it("uses fallbacks for a missing user/customer and a non-Error throw", async () => {
    const h = setup();
    useAuth.mockImplementation((sel) => sel({ token: "t", user: null })); // userName → ""
    pickFromCamera.mockResolvedValue({ photos: [{ uri: "a" }], error: null });
    stampPhoto.mockRejectedValue("plain string"); // non-Error → generic message
    render(<AddDeliveryScreen />);
    act(() => (lastPicker().onPick as (i: unknown) => void)({ customerName: null })); // customerName → null
    await act(async () => { await (lastConfirm().onAddPhoto as () => Promise<void>)(); });
    expect(h.setError).toHaveBeenCalledWith("Couldn't process the photo. Try again.");
  });

  it("does not navigate back when the save fails", async () => {
    setup({ save: vi.fn(() => Promise.resolve(false)) });
    render(<AddDeliveryScreen />);
    act(() => (lastPicker().onPick as (i: unknown) => void)({ customerName: "Acme" }));
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => { await (lastConfirm().onSave as () => Promise<void>)(); });
    expect(router.back).not.toHaveBeenCalled();
  });
});
