import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/market-intelligence/market-intelligence-media", () => ({
  AuthImage: (p: { photoId: string }) => <img alt="" data-photo={p.photoId} />,
  DATE_FMT: { format: (d: Date) => `D:${d.toISOString().slice(0, 10)}` },
}));

import {
  PhotoTile,
  PhotosGrid,
  PhotosSkeletonGrid,
  TileSkeleton,
  type CustomerPhoto,
} from "./customer-photos-grid";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const photo = (over: Partial<CustomerPhoto> = {}): CustomerPhoto => ({
  id: "p1",
  contentType: "image/jpeg",
  category: "customer",
  createdAt: "2026-07-01T00:00:00.000Z",
  uploaderName: "Ravi",
  ...over,
});

describe("skeletons", () => {
  it("render placeholders", () => {
    render(<TileSkeleton />);
    render(<PhotosSkeletonGrid />);
    // Four skeleton tiles in the grid (+1 standalone).
    expect(document.querySelectorAll(".aspect-\\[4\\/3\\]").length).toBe(5);
  });
});

describe("PhotoTile", () => {
  it("shows the date + uploader and fires onOpen on click", () => {
    const onOpen = vi.fn();
    render(<PhotoTile photo={photo()} actionConfig={cfg} onOpen={onOpen} />);
    expect(screen.getByText("D:2026-07-01")).toBeInTheDocument();
    expect(screen.getByText("by Ravi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(photo());
  });

  it("falls back to an em dash when the uploader is null", () => {
    render(<PhotoTile photo={photo({ uploaderName: null })} actionConfig={cfg} onOpen={vi.fn()} />);
    expect(screen.getByText("by —")).toBeInTheDocument();
    expect(screen.getByRole("button").title).toContain("by unknown");
  });
});

describe("PhotosGrid", () => {
  it("renders one tile per photo", () => {
    render(
      <PhotosGrid
        photos={[photo({ id: "a" }), photo({ id: "b" })]}
        actionConfig={cfg}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
