import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeliveryScreenView } from "./delivery-screen-view";

const make = (over: {
  data?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  submit?: Record<string, unknown>;
  photos?: Record<string, unknown>;
} = {}) => ({
  data: { loading: false, active: null, stops: [], refreshing: false, onRefresh: vi.fn(), ...over.data } as never,
  photos: {
    odoPhoto: null, endPhoto: null, stampingPhoto: null, photoError: null,
    setOdoPhoto: vi.fn(), setEndPhoto: vi.fn(), ...over.photos,
  } as never,
  fields: {
    mode: "idle", vehicle: "", odo: "", endOdo: "", startErr: {}, endErr: {},
    changeVehicle: vi.fn(), changeOdo: vi.fn(), changeEndOdo: vi.fn(), setEndErr: vi.fn(), setMode: vi.fn(), ...over.fields,
  } as never,
  submit: {
    error: null, finished: null, busy: false,
    setFinished: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onEndPress: vi.fn(), setError: vi.fn(), ...over.submit,
  } as never,
  placeholder: "#999",
  userName: "Asha",
  onAddPhoto: vi.fn(),
  onAddDelivery: vi.fn(),
});

describe("DeliveryScreenView routing", () => {
  it("loading → DeliveryLoading", () => {
    const { container } = render(<DeliveryScreenView {...make({ data: { loading: true } })} />);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("finished + not active → AllDoneView (Done resets)", () => {
    const setFinished = vi.fn();
    render(<DeliveryScreenView {...make({ submit: { finished: { vehicle: "KA01", stops: 2, km: 10 }, setFinished } })} />);
    expect(screen.getByText("All done!")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(setFinished).toHaveBeenCalledWith(null);
  });

  it("not active + start mode → StartRunForm (start submits, add/clear photo wired)", () => {
    const onStart = vi.fn();
    const onAddPhoto = vi.fn();
    const setOdoPhoto = vi.fn();
    const props = make({ fields: { mode: "start" }, submit: { onStart } });
    props.onAddPhoto = onAddPhoto;
    (props.photos as unknown as { setOdoPhoto: unknown }).setOdoPhoto = setOdoPhoto;
    const { rerender } = render(<DeliveryScreenView {...props} />);
    fireEvent.click(screen.getByText("Take photo")); // add-photo arrow → onAddPhoto("start")
    expect(onAddPhoto).toHaveBeenCalledWith("start");
    fireEvent.click(screen.getAllByText("Start Deliveries").at(-1) as Element);
    expect(onStart).toHaveBeenCalled();
    // With a photo, the ✕ clears it.
    (props.photos as unknown as { odoPhoto: unknown }).odoPhoto = { uri: "x" };
    rerender(<DeliveryScreenView {...props} />);
    fireEvent.click(screen.getByText("✕"));
    expect(setOdoPhoto).toHaveBeenCalledWith(null);
  });

  it("active + end mode → EndRunForm (Back resets mode)", () => {
    const setMode = vi.fn();
    const setEndErr = vi.fn();
    render(
      <DeliveryScreenView
        {...make({ data: { active: { vehicleNumber: "KA01" }, stops: [{ clientUuid: "s1", photoCount: 1 }] }, fields: { mode: "end", setMode, setEndErr } })}
      />,
    );
    expect(screen.getByText(/1 delivery done/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back"));
    expect(setEndErr).toHaveBeenCalledWith({});
    expect(setMode).toHaveBeenCalledWith("idle");
  });

  it("end mode wires add/clear photo", () => {
    const onAddPhoto = vi.fn();
    const setEndPhoto = vi.fn();
    const props = make({ data: { active: { vehicleNumber: "KA01" }, stops: [] }, fields: { mode: "end" } });
    props.onAddPhoto = onAddPhoto;
    (props.photos as unknown as { setEndPhoto: unknown }).setEndPhoto = setEndPhoto;
    const { rerender } = render(<DeliveryScreenView {...props} />);
    fireEvent.click(screen.getByText("Take photo"));
    expect(onAddPhoto).toHaveBeenCalledWith("end");
    (props.photos as unknown as { endPhoto: unknown }).endPhoto = { uri: "y" };
    rerender(<DeliveryScreenView {...props} />);
    fireEvent.click(screen.getByText("✕"));
    expect(setEndPhoto).toHaveBeenCalledWith(null);
  });

  it("active (not end) → ActiveRunView (End press)", () => {
    const onEndPress = vi.fn();
    render(
      <DeliveryScreenView
        {...make({ data: { active: { vehicleNumber: "KA01" }, stops: [] }, submit: { onEndPress } })}
      />,
    );
    expect(screen.getByText(/Vehicle KA01/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("End"));
    expect(onEndPress).toHaveBeenCalled();
  });

  it("idle → IdleView (Start sets mode)", () => {
    const setMode = vi.fn();
    const setError = vi.fn();
    render(<DeliveryScreenView {...make({ fields: { setMode }, submit: { setError } })} />);
    fireEvent.click(screen.getByText("Start Deliveries"));
    expect(setError).toHaveBeenCalledWith(null);
    expect(setMode).toHaveBeenCalledWith("start");
  });
});
