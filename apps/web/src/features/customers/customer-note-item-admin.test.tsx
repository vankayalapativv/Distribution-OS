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
import { NoteItem, type CustomerNote } from "./customer-note-item";
const cfg = { apiBaseUrl: "x", authToken: "t" };
const note = (over: Partial<CustomerNote> = {}): CustomerNote => ({
  id: "n1", body: "Original body", createdAt: "2026-07-01", authorName: "Ravi",
  authorRole: null, edited: false, editedAt: null, editorName: null, ...over,
});
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const renderItem = (n: CustomerNote, isAdmin: boolean) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<NoteItem note={n} isAdmin={isAdmin} customerId="c1" actionConfig={cfg} />, { wrapper: wrap(qc) });
};
afterEach(() => apiRequest.mockClear());

describe("NoteItem — delete + field notes", () => {
  it("deletes only after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderItem(note(), true);
    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(apiRequest).not.toHaveBeenCalled();
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(cfg, "DELETE", "/customers/c1/notes/n1"));
    confirmSpy.mockRestore();
  });

  it("right-aligns a field note (SE) and edits it — the field branch in view + edit", () => {
    renderItem(note({ authorRole: "SALES_EXECUTIVE" }), true);
    expect(document.querySelector(".bg-primary")).toBeTruthy(); // field bubble, right side
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("surfaces an error when deleting fails", async () => {
    apiRequest.mockRejectedValueOnce(new Error("x"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    renderItem(note(), true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByText("Couldn't delete the note.")).toBeInTheDocument());
    confirmSpy.mockRestore();
  });
});
