import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/market-intelligence/market-intelligence-media", () => ({
  AuthImage: (p: { photoId: string }) => <img alt="" data-photo={p.photoId} />,
  DATE_FMT: { format: (d: Date) => `D:${d.toISOString().slice(0, 10)}` },
  DATETIME_FMT: { format: (d: Date) => `DT:${d.toISOString().slice(0, 10)}` },
}));

import { CustomerPhotosTab } from "./customer-photos-tab";
import type { CustomerPhoto } from "./customer-photos-grid";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const photo: CustomerPhoto = {
  id: "p1",
  contentType: "image/jpeg",
  category: "customer",
  createdAt: "2026-07-01T00:00:00.000Z",
  uploaderName: null,
};

describe("CustomerPhotosTab", () => {
  it("shows the loading skeleton grid while loading", () => {
    render(<CustomerPhotosTab photos={[]} isLoading actionConfig={cfg} />);
    expect(document.querySelectorAll(".aspect-\\[4\\/3\\]").length).toBe(4);
  });

  it("shows the empty state when there are no photos", () => {
    render(<CustomerPhotosTab photos={[]} isLoading={false} actionConfig={cfg} />);
    expect(screen.getByText(/No profile photos yet/)).toBeInTheDocument();
  });

  it("renders tiles and opens a preview dialog on click", () => {
    render(<CustomerPhotosTab photos={[photo]} isLoading={false} actionConfig={cfg} />);
    expect(screen.queryByText("Profile photo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Profile photo")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded DT:2026-07-01 by unknown/)).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape" }); // closes → setPreview(null)
    expect(screen.queryByText("Profile photo")).not.toBeInTheDocument();
  });
});
