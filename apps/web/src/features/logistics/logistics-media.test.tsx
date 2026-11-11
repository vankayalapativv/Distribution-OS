import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthImage, PhotoCountBadge, downloadPhoto, fmtTime } from "./logistics-media";

const config = { apiBaseUrl: "http://api", authToken: "tok" };

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fmtTime", () => {
  it("formats a valid timestamp to a time string", () => {
    expect(fmtTime("2026-09-14T03:34:00Z")).toMatch(/\d/);
    expect(typeof fmtTime("not-a-date")).toBe("string");
  });
});

describe("PhotoCountBadge", () => {
  it("shows the count", () => {
    render(<PhotoCountBadge n={7} />);
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });
});

describe("downloadPhoto", () => {
  it("fetches with the bearer token and triggers a download", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }));
    vi.stubGlobal("fetch", fetchMock);
    await downloadPhoto(config, "p1", "photo.jpg");
    expect(fetchMock).toHaveBeenCalledWith("http://api/logistics/photos/p1", { headers: { Authorization: "Bearer tok" } });
    expect(click).toHaveBeenCalled();
  });

  it("does nothing when the response is not ok", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    await downloadPhoto(config, "p1", "photo.jpg");
    expect(click).not.toHaveBeenCalled();
  });
});

describe("AuthImage", () => {
  it("shows a placeholder then the fetched image", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) })));
    render(<AuthImage config={config} photoId="p1" className="cls" />);
    await waitFor(() => expect(screen.getByAltText("Delivery proof")).toBeInTheDocument());
  });

  it("stays a placeholder when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    const { container } = render(<AuthImage config={config} photoId="p1" />);
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeInTheDocument());
  });

  it("swallows a network error and stays a placeholder", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const { container } = render(<AuthImage config={config} photoId="p1" />);
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeInTheDocument());
  });
});
