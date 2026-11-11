import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({}));
const apiRequest = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));
vi.mock("./customer-note-item", () => ({
  notesKey: (id: string) => ["customer-notes", id],
  NoteItem: (p: { note: { id: string; body: string } }) => <li>{p.note.body}</li>,
}));

import { CustomerNotesTab } from "./customer-notes-tab";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

const renderTab = (opts: { notes?: unknown[]; loading?: boolean } = {}) => {
  if (opts.loading) apiGet.mockImplementation(() => new Promise(() => {}));
  else apiGet.mockResolvedValue({ notes: opts.notes ?? [] });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<CustomerNotesTab customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />, { wrapper: wrap(qc) });
  return qc;
};

afterEach(() => {
  apiGet.mockReset();
  apiRequest.mockClear();
});

describe("CustomerNotesTab", () => {
  it("shows skeletons while loading", () => {
    renderTab({ loading: true });
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no notes", async () => {
    renderTab({ notes: [] });
    await waitFor(() => expect(screen.getByText("No notes yet for this customer.")).toBeInTheDocument());
  });

  it("lists notes returned by the query", async () => {
    renderTab({ notes: [{ id: "n1", body: "Hello note" }] });
    await waitFor(() => expect(screen.getByText("Hello note")).toBeInTheDocument());
  });

  it("adds a note, posting the trimmed draft", async () => {
    renderTab({ notes: [] });
    await waitFor(() => expect(screen.getByText("No notes yet for this customer.")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), { target: { value: "  New  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(cfg, "POST", "/customers/c1/notes", { body: "New" }),
    );
  });

  it("shows a Saving… label while the add is in flight", async () => {
    apiRequest.mockImplementationOnce(() => new Promise(() => {}));
    renderTab({ notes: [] });
    await waitFor(() => expect(screen.getByText("No notes yet for this customer.")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), { target: { value: "Pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument());
  });

  it("surfaces an add error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("x"));
    renderTab({ notes: [] });
    await waitFor(() => expect(screen.getByText("No notes yet for this customer.")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), { target: { value: "Bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(screen.getByText("Couldn't save the note.")).toBeInTheDocument());
  });
});
