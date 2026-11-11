import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./task-attachment-link", () => ({
  AttachmentLink: ({ attachment }: { readonly attachment: { fileName: string } }) => <span>{attachment.fileName}</span>,
}));

import { TaskAttachments } from "./task-attachments";
import type { TaskAttachment } from "./tasks-api";

const config = { apiBaseUrl: "http://api", authToken: "tok" };
const att = (id: string, fileName: string): TaskAttachment => ({ id, fileName, contentType: "application/pdf", createdAt: "x" });
const base = { taskId: "t1", attachments: [] as TaskAttachment[], loading: false, actionConfig: config, onError: vi.fn(), onAdded: vi.fn() };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("TaskAttachments", () => {
  it("shows loading, empty and populated states", () => {
    const { rerender } = render(<TaskAttachments {...base} loading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    rerender(<TaskAttachments {...base} loading={false} />);
    expect(screen.getByText("No attachments.")).toBeInTheDocument();
    rerender(<TaskAttachments {...base} attachments={[att("a1", "invoice.pdf")]} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("opens the file picker from the Attach button", () => {
    const { container } = render(<TaskAttachments {...base} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByText("Attach file"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("uploads a chosen file and notifies", async () => {
    const onAdded = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: att("a9", "new.pdf") }) })));
    const { container } = render(<TaskAttachments {...base} onAdded={onAdded} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "new.pdf")] } });
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(att("a9", "new.pdf")));
    expect(fetch).toHaveBeenCalledWith("http://api/tasks/t1/attachments", expect.objectContaining({ method: "POST" }));
  });

  it("surfaces an upload failure", async () => {
    const onError = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 413 })));
    const { container } = render(<TaskAttachments {...base} onError={onError} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "big.pdf")] } });
    // errorMessage surfaces the thrown Error's own message.
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Upload failed")));
  });
});
