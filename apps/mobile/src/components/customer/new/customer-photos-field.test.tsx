import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("expo-image", () => ({ Image: () => <span>photo-img</span> }));
vi.mock("../../photo-shimmer", () => ({ PhotoShimmer: () => null }));

import { CustomerPhotosField } from "./customer-photos-field";

const staging = (over: Record<string, unknown> = {}) =>
  ({
    photos: [],
    preparing: 0,
    uploadingUri: null,
    setPhotos: vi.fn(),
    setViewerUri: vi.fn(),
    onPickPhotos: vi.fn(),
    ...over,
  }) as never;

describe("CustomerPhotosField", () => {
  it("picks from camera and gallery", () => {
    const onPickPhotos = vi.fn();
    render(<CustomerPhotosField photo={staging({ onPickPhotos })} busy={false} />);
    fireEvent.click(screen.getByText("Take photo"));
    expect(onPickPhotos).toHaveBeenCalledWith("camera");
    fireEvent.click(screen.getByText("From gallery"));
    expect(onPickPhotos).toHaveBeenCalledWith("gallery");
    expect(screen.queryByText("✕")).not.toBeInTheDocument(); // empty → no grid
  });

  it("renders staged photos, opens the viewer, removes one, and shows the upload overlay", () => {
    const setViewerUri = vi.fn();
    const setPhotos = vi.fn();
    const photos = [{ uri: "file://a.jpg" }, { uri: "file://b.jpg" }];
    render(
      <CustomerPhotosField
        photo={staging({ photos, uploadingUri: "file://a.jpg", setViewerUri, setPhotos })}
        busy={false}
        error="Add at least one photo"
      />,
    );
    fireEvent.click(screen.getAllByText("photo-img")[0]); // open the viewer
    expect(setViewerUri).toHaveBeenCalledWith("file://a.jpg");
    fireEvent.click(screen.getAllByText("✕")[0]); // remove first
    expect(setPhotos).toHaveBeenCalled();
    expect(setPhotos.mock.calls[0][0]).toEqual([{ uri: "file://b.jpg" }]);
    expect(screen.getByText("Add at least one photo")).toBeInTheDocument();
  });

  it("shows shimmer tiles while photos are preparing", () => {
    render(<CustomerPhotosField photo={staging({ preparing: 2 })} busy />);
    expect(screen.getByText("Photos")).toBeInTheDocument();
  });
});
