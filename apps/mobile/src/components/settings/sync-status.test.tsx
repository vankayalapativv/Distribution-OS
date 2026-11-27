import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const kickSync = vi.fn();
vi.mock("../../lib/sync", () => ({ kickSync: () => kickSync() }));

import { FailedItemsCard, SyncCard } from "./sync-status";
import type { SyncState } from "../../lib/sync-store";

const state = (over: Partial<SyncState> = {}): SyncState => ({ syncing: false, pending: 0, ...over }) as SyncState;

describe("SyncCard", () => {
  it("shows the synced / pending / syncing status and kicks a manual sync", () => {
    const { rerender } = render(<SyncCard sync={state()} />);
    expect(screen.getByText("Everything is synced")).toBeInTheDocument();
    rerender(<SyncCard sync={state({ pending: 1 })} />);
    expect(screen.getByText(/1 item waiting to sync/)).toBeInTheDocument(); // singular
    rerender(<SyncCard sync={state({ pending: 3 })} />);
    expect(screen.getByText(/3 items waiting to sync/)).toBeInTheDocument(); // plural
    rerender(<SyncCard sync={state({ syncing: true })} />);
    expect(screen.getByText("Syncing…")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sync now"));
    expect(kickSync).toHaveBeenCalled();
  });
});

describe("FailedItemsCard", () => {
  it("lists failed items with mapped labels + errors and a retry-all action", () => {
    const onRetry = vi.fn();
    render(
      <FailedItemsCard
        failedItems={[
          { id: "1", entityType: "order", lastError: "500 server error" } as never,
          { id: "2", entityType: "mystery", lastError: null } as never,
        ]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("2 failed items")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument(); // mapped label
    expect(screen.getByText("mystery")).toBeInTheDocument(); // raw fallback
    expect(screen.getByText("500 server error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry all"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("uses the singular heading for one item", () => {
    render(<FailedItemsCard failedItems={[{ id: "1", entityType: "collection", lastError: null } as never]} onRetry={() => {}} />);
    expect(screen.getByText("1 failed item")).toBeInTheDocument();
  });
});
