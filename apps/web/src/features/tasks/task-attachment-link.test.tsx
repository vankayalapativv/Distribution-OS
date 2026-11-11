import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentLink } from "./task-attachment-link";

const config = { apiBaseUrl: "http://api", authToken: "tok" };
const attachment = { id: "a1", fileName: "invoice.pdf", contentType: "application/pdf", createdAt: "x" };

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("AttachmentLink", () => {
  it("opens the file in a new tab with the bearer token", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AttachmentLink attachment={attachment} config={config} />);
    fireEvent.click(screen.getByText("invoice.pdf"));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith("blob:x", "_blank", "noopener"));
    expect(fetchMock).toHaveBeenCalledWith("http://api/task-files/a1", { headers: { Authorization: "Bearer tok" } });
  });

  it("stays silent when the download fails", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    render(<AttachmentLink attachment={attachment} config={config} />);
    fireEvent.click(screen.getByText("invoice.pdf"));
    await waitFor(() => expect(screen.getByText("invoice.pdf")).toBeEnabled());
    expect(openSpy).not.toHaveBeenCalled();
  });
});
