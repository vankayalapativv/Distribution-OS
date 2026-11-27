import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

type ListProps = { data: unknown[]; renderItem: (i: { item: unknown }) => React.ReactNode; keyExtractor: (i: unknown) => string; ListHeaderComponent?: React.ReactNode; ListEmptyComponent?: React.ReactNode };
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  return {
    ...actual,
    FlatList: ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent }: ListProps) => (
      <div>{ListHeaderComponent}{data.length === 0 ? ListEmptyComponent : data.map((item, i) => { keyExtractor(item); return <div key={i}>{renderItem({ item })}</div>; })}</div>
    ),
  };
});

let params: Record<string, unknown> = { id: "c1", customerName: "Acme" };
vi.mock("expo-router", () => ({ router: { back: vi.fn() }, useLocalSearchParams: () => params }));
const useCachedQuery = vi.fn();
const mutate = vi.fn();
let mutCfg: { mutationFn: (b: string) => unknown; onSuccess: () => void; onError: () => void };
const invalidateQueries = vi.fn();
const apiFetch = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (cfg: typeof mutCfg) => { mutCfg = cfg; return { mutate, isPending: false }; },
}));
vi.mock("../../lib/use-cached-query", () => ({ useCachedQuery: (cfg: { fetcher: () => unknown }) => { cfg.fetcher(); return useCachedQuery(); } }));
let authToken: string | null = "t";
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ token: authToken }) }));
let online = true;
vi.mock("../../lib/connectivity", () => ({ useIsOnline: () => online }));
vi.mock("../../lib/cache-keys", () => ({ cacheKeys: { notes: (id: string) => `notes:${id}` } }));
vi.mock("../../lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../../components/notes/add-note-box", () => ({ AddNoteBox: ({ onSave, setDraft, canSave }: { onSave: () => void; setDraft: (t: string) => void; canSave: boolean }) => <div><button type="button" onClick={() => setDraft("hi there")}>set-draft</button><button type="button" onClick={onSave}>add-note</button><span>can-{String(canSave)}</span></div> }));
vi.mock("../../components/notes/note-card", () => ({ NoteCard: ({ note }: { note: { id: string } }) => <span>note-{note.id}</span> }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>error-state</button> }));

import NotesScreen from "./[id]";

describe("NotesScreen", () => {
  it("renders notes and submits a draft via the mutation", () => {
    useCachedQuery.mockReturnValue({ data: { notes: [{ id: "n1" }] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    expect(screen.getByText("note-n1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("set-draft")); // draft non-empty → canSave true
    expect(screen.getByText("can-true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("add-note"));
    expect(mutate).toHaveBeenCalled();
    // Exercise the mutation config: mutationFn + success + error callbacks.
    mutCfg.mutationFn("hello");
    expect(apiFetch).toHaveBeenCalled();
    mutCfg.onSuccess();
    expect(invalidateQueries).toHaveBeenCalled();
    mutCfg.onError();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("disables save while offline even with a draft", () => {
    online = false;
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("set-draft")); // draft non-empty but offline → canSave false
    expect(screen.getByText("can-false")).toBeInTheDocument();
    online = true;
  });

  it("shows the loading skeleton (empty slot)", () => {
    useCachedQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("shows the error slot (retry)", () => {
    const refetch = vi.fn();
    useCachedQuery.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error("x"), refetch });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("error-state"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty hint with no id/name and no token", () => {
    params = {}; // no id → cacheKey `id ?? ""` fallback; no token → enabled false
    authToken = null;
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
    params = { id: "c1", customerName: "Acme" };
    authToken = "t";
  });
});
