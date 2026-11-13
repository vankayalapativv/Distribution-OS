import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));
vi.mock("@/lib/format", () => ({ formatDateTime: (d: string) => `t:${d}` }));

import { NoteItem, notesKey, type CustomerNote } from "./customer-note-item";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const note = (over: Partial<CustomerNote> = {}): CustomerNote => ({
  id: "n1",
  body: "Original body",
  createdAt: "2026-07-01",
  authorName: "Ravi",
  authorRole: null,
  edited: false,
  editedAt: null,
  editorName: null,
  ...over,
});

const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

const renderItem = (n: CustomerNote, isAdmin: boolean) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(<NoteItem note={n} isAdmin={isAdmin} customerId="c1" actionConfig={cfg} />, { wrapper: wrap(qc) });
  return { invalidate };
};

afterEach(() => apiRequest.mockClear());

describe("notesKey", () => {
  it("is scoped to the customer", () => {
    expect(notesKey("c1")).toEqual(["customer-notes", "c1"]);
  });
});

describe("NoteItem", () => {
  it("hides admin controls for non-admins and shows the body", () => {
    renderItem(note(), false);
    expect(screen.getByText("Original body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("shows the edited badge and editor footer when edited", () => {
    renderItem(note({ edited: true, editorName: "Admin", editedAt: "2026-07-02" }), false);
    expect(screen.getByText("· edited")).toBeInTheDocument();
    expect(screen.getByText(/edited by Admin · t:2026-07-02/)).toBeInTheDocument();
  });

  it("edits and saves a note, invalidating the cache", async () => {
    const { invalidate } = renderItem(note(), true);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: " Updated  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(cfg, "PATCH", "/customers/c1/notes/n1", { body: "Updated" }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: notesKey("c1") }));
  });

  it("surfaces a save error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("no"));
    renderItem(note(), true);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Couldn't update the note.")).toBeInTheDocument());
  });

  it("shows a Saving… label while the save is in flight", async () => {
    apiRequest.mockImplementationOnce(() => new Promise(() => {}));
    renderItem(note(), true);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument());
  });

  it("cancels an edit without saving", () => {
    renderItem(note(), true);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Original body")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("deletes only after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderItem(note(), true);

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(apiRequest).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(cfg, "DELETE", "/customers/c1/notes/n1"),
    );
    confirmSpy.mockRestore();
  });
});
