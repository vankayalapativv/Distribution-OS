import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

let params: Record<string, unknown> = { id: "c1", customerName: "Acme" };
vi.mock("expo-router", () => ({ useLocalSearchParams: () => params }));
const useCachedQuery = vi.fn();
vi.mock("../../lib/use-cached-query", () => ({ useCachedQuery: (cfg: { fetcher: () => unknown }) => { cfg.fetcher(); return useCachedQuery(); } }));
vi.mock("../../lib/use-pull-refresh", () => ({ usePullRefresh: (fn: () => unknown) => { fn(); return { refreshing: false, onRefresh: fn }; } }));
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ token: "t" }) }));
vi.mock("../../lib/cache-keys", () => ({ cacheKeys: { ledger: (id: string) => `ledger:${id}` } }));
vi.mock("../../lib/ledger-fetch", () => ({ fetchFullLedger: vi.fn() }));
vi.mock("../../lib/ledger-presets", () => ({ presetRange: () => ({ from: "2026-11-01", to: "2026-11-30" }) }));
vi.mock("../../lib/ledger", () => ({ sliceLedger: () => ({ totals: { closingBalance: 500 } }) }));
vi.mock("../../components/ledger/ledger-header", () => ({ LedgerHeader: ({ customerName }: { customerName: string }) => <span>header-{customerName}</span> }));
vi.mock("../../components/ledger/range-presets", () => ({ RangePresets: ({ onSelect }: { onSelect: (k: string) => void }) => <button type="button" onClick={() => onSelect("last-month")}>presets</button> }));
vi.mock("../../components/ledger/ledger-body", () => ({ LedgerBody: () => <span>ledger-body</span> }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry</button> }));

import CustomerLedgerScreen from "./[id]";

describe("CustomerLedgerScreen", () => {
  it("shows the skeleton while loading", () => {
    useCachedQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
    render(<CustomerLedgerScreen />);
    expect(screen.getByText("header-Acme")).toBeInTheDocument();
    expect(screen.queryByText("ledger-body")).not.toBeInTheDocument();
  });

  it("shows an error state (retry) and switches range presets", () => {
    const refetch = vi.fn();
    useCachedQuery.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error("x"), refetch });
    render(<CustomerLedgerScreen />);
    fireEvent.click(screen.getByText("presets")); // onSelect → setPreset re-render
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("tolerates a missing id (cache key fallback)", () => {
    params = {};
    useCachedQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
    render(<CustomerLedgerScreen />);
    expect(screen.getByText("header-Customer")).toBeInTheDocument();
    params = { id: "c1", customerName: "Acme" };
  });

  it("renders the ledger body with sliced data (name falls back)", () => {
    params = { id: "c1" };
    useCachedQuery.mockReturnValue({ data: { rows: [] }, isPending: false, isError: false, error: null, refetch: vi.fn() });
    render(<CustomerLedgerScreen />);
    expect(screen.getByText("header-Customer")).toBeInTheDocument();
    expect(screen.getByText("ledger-body")).toBeInTheDocument();
    params = { id: "c1", customerName: "Acme" };
  });
});
