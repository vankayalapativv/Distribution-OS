import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

let pullFn: (() => Promise<unknown>) | null = null;
let params: Record<string, unknown> = { id: "c1", name: "Acme" };
const useCustomerScreen = vi.fn();
const usePhotos = vi.fn();
const useCheckIn = vi.fn();

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => params,
  useFocusEffect: (cb: () => void) => { cb(); },
}));
vi.mock("../../lib/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel(globalThis.__authState) }));
vi.mock("../../components/dialog", () => ({ useDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../lib/customer/queries", () => ({ useCustomerScreen: (...a: unknown[]) => useCustomerScreen(...a) }));
vi.mock("../../lib/customer/use-photos", () => ({ usePhotos: (...a: unknown[]) => usePhotos(...a) }));
vi.mock("../../lib/customer/use-checkin", () => ({ useCheckIn: (...a: unknown[]) => useCheckIn(...a) }));
vi.mock("../../lib/use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<unknown>) => { pullFn = fn; return { refreshing: false, onRefresh: fn }; } }));

vi.mock("../../components/customer/top-bar", () => ({ CustomerTopBar: ({ name }: { name: string }) => <span>top-{name}</span> }));
vi.mock("../../components/customer/customer-skeleton", () => ({ CustomerSkeleton: () => <span>skeleton</span> }));
vi.mock("../../components/customer/hero-card", () => ({ HeroCard: () => <span>hero</span> }));
vi.mock("../../components/customer/check-in-button", () => ({ CheckInButton: ({ onPress }: { onPress: () => void }) => <button type="button" onClick={onPress}>checkin</button> }));
vi.mock("../../components/customer/followup-card", () => ({ FollowupCard: () => <span>followup</span> }));
vi.mock("../../components/customer/action-row", () => ({ ActionRow: ({ onMarket, isAdmin }: { onMarket: () => void; isAdmin: boolean }) => <button type="button" onClick={onMarket}>market-{String(isAdmin)}</button> }));
vi.mock("../../components/customer/orders-section", () => ({ OrdersSection: ({ onOpen }: { onOpen: (o: unknown) => void }) => <button type="button" onClick={() => onOpen({ id: "o1", fulfillmentStatus: "delivered" })}>open-order</button> }));
vi.mock("../../components/customer/collections-section", () => ({ CollectionsSection: () => <span>collections</span> }));
vi.mock("../../components/customer/photos-section", () => ({ PhotosSection: () => <span>photos</span> }));
vi.mock("../../components/customer/photo-capture-sheet", () => ({ PhotoCaptureSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (visible ? <button type="button" onClick={onClose}>close-market</button> : null) }));
vi.mock("../../components/order-detail-sheet", () => ({ OrderDetailSheet: ({ onClose }: { onClose: () => void }) => <button type="button" onClick={onClose}>close-order</button> }));

import CustomerDetailScreen from "./[id]";

declare global { var __authState: { token: string; user: { id: string; role: string; name: string } | null }; }

function setup(role = "SALES_EXECUTIVE", over: Record<string, unknown> = {}) {
  globalThis.__authState = { token: "t", user: { id: "u1", role, name: "Rep" } };
  useCustomerScreen.mockReturnValue({
    headerQuery: { data: { legalName: "Acme Oils", customerCode: "C1", creditBlocked: false, isFetchedAfterMount: true }, isPending: false, isFetchedAfterMount: true },
    creditQuery: { data: { creditBlocked: false }, isPending: false },
    ordersQuery: {}, collectionsQuery: {}, invalidate: vi.fn(() => Promise.resolve()),
    ...over,
  });
  usePhotos.mockReturnValue({ query: { refetch: vi.fn(() => Promise.resolve()) }, onAdd: vi.fn() });
  useCheckIn.mockImplementation((cfg: { onChanged?: () => void }) => {
    cfg.onChanged?.(); // exercise the invalidate-on-change callback
    return { state: "none", busy: false, onPress: vi.fn(() => Promise.resolve()), reasonSheet: <span>reason-sheet</span>, followupSheet: <span>followup-sheet</span> };
  });
}

describe("CustomerDetailScreen", () => {
  it("renders the full SE surface and drives the sheets + refresh", async () => {
    setup();
    render(<CustomerDetailScreen />);
    expect(screen.getByText("hero")).toBeInTheDocument();
    expect(screen.getByText("followup")).toBeInTheDocument(); // SE → follow-up card
    expect(screen.getByText("photos")).toBeInTheDocument();
    fireEvent.click(screen.getByText("checkin"));
    // Market capture sheet open → close.
    fireEvent.click(screen.getByText("market-false"));
    fireEvent.click(screen.getByText("close-market"));
    // Order detail sheet open → close.
    fireEvent.click(screen.getByText("open-order"));
    fireEvent.click(screen.getByText("close-order"));
    await pullFn?.();
  });

  it("hides the field-capture surfaces for a Super Admin (credit from header)", () => {
    setup("SUPER_ADMIN", { headerQuery: { data: { legalName: null, customerName: "Acme", creditBlocked: true, customerCode: null }, isPending: false, isFetchedAfterMount: false }, creditQuery: { data: null, isPending: false } });
    render(<CustomerDetailScreen />);
    expect(screen.getByText("market-true")).toBeInTheDocument();
    expect(screen.queryByText("followup")).not.toBeInTheDocument();
    expect(screen.queryByText("photos")).not.toBeInTheDocument();
  });

  it("shows the skeleton while the header is loading (name falls back)", () => {
    setup("SALES_EXECUTIVE", { headerQuery: { data: undefined, isPending: true, isFetchedAfterMount: false } });
    render(<CustomerDetailScreen />);
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(screen.getByText("top-Acme")).toBeInTheDocument(); // name param fallback
  });

  it("falls back to 'Customer' with no header, no name, and a null user", () => {
    params = { id: "c1" }; // no name param
    setup("SALES_EXECUTIVE", { headerQuery: { data: undefined, isPending: true, isFetchedAfterMount: false } });
    globalThis.__authState = { token: "t", user: null }; // user?.* → undefined branches
    render(<CustomerDetailScreen />);
    expect(screen.getByText("top-Customer")).toBeInTheDocument();
    params = { id: "c1", name: "Acme" }; // restore
  });
});
