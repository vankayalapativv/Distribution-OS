import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  const R = (await import("react")) as typeof import("react");
  // FlatList stub: forwards a ref with scrollToEnd, fires onContentSizeChange,
  // and invokes renderItem/keyExtractor per item.
  const FlatList = R.forwardRef(
    (p: { data: unknown[]; renderItem: (i: { item: unknown }) => React.ReactNode; keyExtractor: (i: unknown, n: number) => string; onContentSizeChange?: () => void }, ref: React.Ref<unknown>) => {
      R.useImperativeHandle(ref, () => ({ scrollToEnd: vi.fn() }));
      R.useEffect(() => { p.onContentSizeChange?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return (
        <div>
          {p.data.map((item, i) => {
            p.keyExtractor(item, i);
            return <div key={i}>{p.renderItem({ item })}</div>;
          })}
        </div>
      );
    },
  );
  return { ...actual, FlatList };
});

let params: Record<string, unknown> = { id: "c1", customerName: "Acme" };
let authUser: { name: string } | null = { name: "Asha" };
let online = true;
const useCachedQuery = vi.fn();
const mutate = vi.fn();
let mutCfg: { mutationFn: (b: string) => unknown; onSuccess: () => void; onError: () => void };
let isPending = false;
const invalidateQueries = vi.fn();
const apiFetch = vi.fn();

vi.mock("expo-router", () => ({ router: { back: vi.fn() }, useLocalSearchParams: () => params }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (cfg: typeof mutCfg) => { mutCfg = cfg; return { mutate, isPending }; },
}));
vi.mock("../../lib/use-cached-query", () => ({ useCachedQuery: (cfg: { fetcher: () => unknown }) => { cfg.fetcher(); return useCachedQuery(); } }));
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ token: "t", user: authUser }) }));
vi.mock("../../lib/connectivity", () => ({ useIsOnline: () => online }));
vi.mock("../../lib/cache-keys", () => ({ cacheKeys: { notes: (id: string) => `notes:${id}` } }));
vi.mock("../../lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../../components/notes/chat-bubble", () => ({ ChatBubble: ({ note, mine }: { note: { id: string }; mine: boolean }) => <span>bubble-{note.id}-{String(mine)}</span> }));
vi.mock("../../components/notes/chat-day-separator", () => ({ ChatDaySeparator: ({ label }: { label: string }) => <span>day-{label}</span> }));
vi.mock("../../components/notes/notes-chat-skeleton", () => ({ NotesChatSkeleton: () => <span>chat-skeleton</span> }));
vi.mock("../../components/notes/notes-compose-bar", () => ({ NotesComposeBar: ({ onChange, onSave, canSave, offline: off }: { onChange: (t: string) => void; onSave: () => void; canSave: boolean; offline: boolean }) => (
  <div>
    <button type="button" onClick={() => onChange("Hello")}>type</button>
    <button type="button" onClick={onSave}>send</button>
    <span>can-{String(canSave)}-off-{String(off)}</span>
  </div>
) }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry</button> }));

import NotesScreen from "./[id]";

const reset = () => { params = { id: "c1", customerName: "Acme" }; authUser = { name: "Asha" }; online = true; isPending = false; vi.clearAllMocks(); };

describe("NotesScreen (chat)", () => {
  it("shows the chat skeleton while loading", () => {
    reset();
    useCachedQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    expect(screen.getByText("chat-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows a retryable error", () => {
    reset();
    const refetch = vi.fn();
    useCachedQuery.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error("x"), refetch });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty hint (no notes, no customer name)", () => {
    reset();
    params = { id: "c1" };
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
  });

  it("renders the transcript (day separators + my/their bubbles), types, sends, and goes back", () => {
    reset();
    useCachedQuery.mockReturnValue({
      data: { notes: [
        { id: "mine", body: "a", createdAt: "2026-11-27T10:00:00Z", authorName: "Asha", edited: false, editedAt: null, editorName: null },
        { id: "theirs", body: "b", createdAt: "2026-11-26T10:00:00Z", authorName: "Priya", edited: false, editedAt: null, editorName: null },
      ] },
      isPending: false, isError: false, error: null, refetch: vi.fn(),
    });
    render(<NotesScreen />);
    expect(screen.getByText("bubble-mine-true")).toBeInTheDocument();
    expect(screen.getByText("bubble-theirs-false")).toBeInTheDocument();
    expect(screen.getAllByText(/^day-/).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByText("type")); // onChange → setDraft + clear error
    fireEvent.click(screen.getByText("send")); // onSave → mutate
    expect(mutate).toHaveBeenCalled();
    // exercise the mutation config
    mutCfg.mutationFn("hi");
    expect(apiFetch).toHaveBeenCalled();
    act(() => mutCfg.onSuccess());
    expect(invalidateQueries).toHaveBeenCalled();
    act(() => mutCfg.onError()); // sets an error…
    fireEvent.click(screen.getByText("type")); // …then typing clears it (if(error) branch)
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("enables save when online with a draft (unknown user, no id tolerated)", () => {
    reset();
    authUser = null; params = {};
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("type"));
    expect(screen.getByText("can-true-off-false")).toBeInTheDocument();
  });

  it("blocks save while offline even with a draft", () => {
    reset();
    online = false;
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("type"));
    expect(screen.getByText("can-false-off-true")).toBeInTheDocument();
  });

  it("blocks save while a save is already in flight", () => {
    reset();
    isPending = true;
    useCachedQuery.mockReturnValue({ data: { notes: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<NotesScreen />);
    fireEvent.click(screen.getByText("type"));
    expect(screen.getByText("can-false-off-false")).toBeInTheDocument();
  });
});
