import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { router } from "expo-router";

const props: Array<Record<string, unknown>> = [];
vi.mock("../../components/delivery/delivery-screen-view", () => ({ DeliveryScreenView: (p: Record<string, unknown>) => { props.push(p); return null; } }));

const useAuth = vi.fn();
const useDeliveryRunData = vi.fn();
const useRunPhotos = vi.fn();
const useRunFields = vi.fn();
const useDeliveryRunForm = vi.fn();
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => useAuth(sel) }));
vi.mock("../../lib/theme", () => ({ usePlaceholderColor: () => "#999" }));
vi.mock("../../lib/use-delivery-run-data", () => ({ useDeliveryRunData: () => useDeliveryRunData() }));
vi.mock("../../lib/use-run-photos", () => ({ useRunPhotos: () => useRunPhotos() }));
vi.mock("../../lib/use-run-fields", () => ({ useRunFields: () => useRunFields() }));
vi.mock("../../lib/use-delivery-run-form", () => ({ useDeliveryRunForm: (a: unknown) => useDeliveryRunForm(a) }));

import DeliveryScreen from "./delivery";

const latest = () => props[props.length - 1];

function setup(over: { addPhoto?: (w: string) => Promise<boolean>; active?: unknown } = {}) {
  const addPhoto = over.addPhoto ?? vi.fn(() => Promise.resolve(true));
  const setError = vi.fn();
  const clearStartPhotoErr = vi.fn();
  const clearEndPhotoErr = vi.fn();
  useAuth.mockImplementation((sel) => sel({ user: { name: "Driver" } }));
  useDeliveryRunData.mockReturnValue({ active: "active" in over ? over.active : { clientUuid: "run-1" }, stops: [], reload: vi.fn() });
  useRunPhotos.mockReturnValue({ addPhoto, odoPhoto: null, endPhoto: null, resetPhotos: vi.fn() });
  useRunFields.mockReturnValue({ clearStartPhotoErr, clearEndPhotoErr });
  useDeliveryRunForm.mockReturnValue({ setError });
  return { setError, clearStartPhotoErr, clearEndPhotoErr };
}

describe("DeliveryScreen (logistics)", () => {
  it("adds a start photo (clears the start-photo error)", async () => {
    const h = setup();
    render(<DeliveryScreen />);
    await (latest().onAddPhoto as (w: string) => Promise<void>)("start");
    expect(h.setError).toHaveBeenCalledWith(null);
    expect(h.clearStartPhotoErr).toHaveBeenCalled();
  });

  it("adds an end photo (clears the end-photo error)", async () => {
    const h = setup();
    render(<DeliveryScreen />);
    await (latest().onAddPhoto as (w: string) => Promise<void>)("end");
    expect(h.clearEndPhotoErr).toHaveBeenCalled();
  });

  it("bails out when the photo capture is cancelled", async () => {
    const h = setup({ addPhoto: vi.fn(() => Promise.resolve(false)) });
    render(<DeliveryScreen />);
    await (latest().onAddPhoto as (w: string) => Promise<void>)("start");
    expect(h.setError).not.toHaveBeenCalled();
  });

  it("navigates to add-delivery with the active run uuid (and empty when none)", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear();
    setup({ active: null });
    useAuth.mockImplementation((sel) => sel({ user: null })); // userName → "" fallback
    render(<DeliveryScreen />);
    (latest().onAddDelivery as () => void)();
    expect(router.push).toHaveBeenCalledWith({ pathname: "/(logistics)/add-delivery", params: { runClientUuid: "" } });
  });
});
