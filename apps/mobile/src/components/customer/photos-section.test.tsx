import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const confirm = vi.fn(() => Promise.resolve(true));
vi.mock("../dialog", () => ({ useDialog: () => ({ confirm }) }));
vi.mock("expo-image", () => ({ Image: () => null }));
vi.mock("../photo-zoom-viewer", () => ({
  PhotoZoomViewer: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close-viewer
    </button>
  ),
}));
vi.mock("../photo-shimmer", () => ({ PhotoShimmer: () => null }));

import { PhotosSection } from "./photos-section";

const state = (over: Record<string, unknown> = {}) =>
  ({
    query: { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() },
    uploading: false,
    uploadError: null,
    onDelete: vi.fn(() => Promise.resolve()),
    ...over,
  }) as never;

describe("PhotosSection", () => {
  it("shows the empty state", () => {
    render(<PhotosSection state={state()} token="t" />);
    expect(screen.getByText(/No photos yet/)).toBeInTheDocument();
  });

  it("shows a skeleton while pending", () => {
    render(<PhotosSection state={state({ query: { data: undefined, isPending: true, isError: false, refetch: vi.fn() } })} token="t" />);
    expect(screen.queryByText(/No photos yet/)).not.toBeInTheDocument();
  });

  it("shows an error state and retries", () => {
    const refetch = vi.fn();
    render(
      <PhotosSection
        state={state({ query: { data: undefined, isPending: false, isError: true, error: new Error("x"), refetch } })}
        token="t"
      />,
    );
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
  });

  it("surfaces an upload error and the uploading indicator", () => {
    render(<PhotosSection state={state({ uploading: true, uploadError: "Upload failed" })} token={null} />);
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
  });

  it("renders a photo grid, opens the viewer, and deletes with confirmation", async () => {
    const onDelete = vi.fn(() => Promise.resolve());
    render(
      <PhotosSection
        state={state({ query: { data: [{ id: "ph1" }], isPending: false, isError: false, refetch: vi.fn() }, onDelete })}
        token="t"
      />,
    );
    fireEvent.click(screen.getByLabelText("View photo"));
    fireEvent.click(screen.getByText("close-viewer")); // closes the zoom viewer
    expect(screen.queryByText("close-viewer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("ph1"));
  });

  it("does not delete when the confirm is declined", async () => {
    confirm.mockResolvedValueOnce(false);
    const onDelete = vi.fn(() => Promise.resolve());
    render(
      <PhotosSection
        state={state({ query: { data: [{ id: "ph2" }], isPending: false, isError: false, refetch: vi.fn() }, onDelete })}
        token="t"
      />,
    );
    fireEvent.click(screen.getByText("✕"));
    await Promise.resolve();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
