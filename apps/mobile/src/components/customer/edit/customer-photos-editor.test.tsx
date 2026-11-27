import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const confirm = vi.fn(() => Promise.resolve(true));
vi.mock("../../dialog", () => ({ useDialog: () => ({ confirm }) }));
vi.mock("expo-image", () => ({ Image: () => <span>photo-img</span> }));
vi.mock("../../photo-shimmer", () => ({ PhotoShimmer: () => null }));
vi.mock("../../photo-zoom-viewer", () => ({
  PhotoZoomViewer: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>close-viewer</button>
  ),
}));

import { CustomerPhotosEditor } from "./customer-photos-editor";

const photos = (over: Record<string, unknown> = {}) =>
  ({
    query: { data: [], isPending: false, refetch: vi.fn() },
    photoBusy: false,
    onAddPhotos: vi.fn(),
    onDeletePhoto: vi.fn(() => Promise.resolve()),
    ...over,
  }) as never;

describe("CustomerPhotosEditor", () => {
  it("adds from camera/gallery and shows the empty state", () => {
    const onAddPhotos = vi.fn();
    render(<CustomerPhotosEditor photos={photos({ onAddPhotos })} token="t" />);
    fireEvent.click(screen.getByText("Take photo"));
    expect(onAddPhotos).toHaveBeenCalledWith("camera");
    fireEvent.click(screen.getByText("From gallery"));
    expect(onAddPhotos).toHaveBeenCalledWith("gallery");
    expect(screen.getByText("No customer photos yet.")).toBeInTheDocument();
  });

  it("shows a skeleton while pending", () => {
    render(<CustomerPhotosEditor photos={photos({ query: { data: undefined, isPending: true, refetch: vi.fn() } })} token={null} />);
    expect(screen.queryByText("No customer photos yet.")).not.toBeInTheDocument();
  });

  it("shows the upload shimmer while busy (grid entered via photoBusy)", () => {
    render(
      <CustomerPhotosEditor
        photos={photos({ query: { data: undefined, isPending: false, refetch: vi.fn() }, photoBusy: true })}
        token="t"
      />,
    );
    expect(screen.queryByText("No customer photos yet.")).not.toBeInTheDocument();
  });

  it("renders a grid, opens + closes the viewer, and deletes with confirm", async () => {
    const onDeletePhoto = vi.fn(() => Promise.resolve());
    render(
      <CustomerPhotosEditor
        photos={photos({ query: { data: [{ id: "p1" }], isPending: false, refetch: vi.fn() }, onDeletePhoto })}
        token="t"
      />,
    );
    fireEvent.click(screen.getByLabelText("View photo"));
    fireEvent.click(screen.getByText("close-viewer"));
    expect(screen.queryByText("close-viewer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    await waitFor(() => expect(onDeletePhoto).toHaveBeenCalledWith("p1"));
  });

  it("skips delete when the confirm is declined", async () => {
    confirm.mockResolvedValueOnce(false);
    const onDeletePhoto = vi.fn(() => Promise.resolve());
    render(
      <CustomerPhotosEditor
        photos={photos({ query: { data: [{ id: "p2" }], isPending: false, refetch: vi.fn() }, onDeletePhoto })}
        token="t"
      />,
    );
    fireEvent.click(screen.getByText("✕"));
    await Promise.resolve();
    expect(onDeletePhoto).not.toHaveBeenCalled();
  });
});
