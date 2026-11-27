import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

type ListProps = { data: unknown[]; renderItem: (i: { item: unknown }) => React.ReactNode; keyExtractor: (i: unknown) => string; ListEmptyComponent?: React.ReactNode };
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  return {
    ...actual,
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent }: ListProps) => (
      <div>{data.length === 0 ? ListEmptyComponent : data.map((item, i) => { keyExtractor(item); return <div key={i}>{renderItem({ item })}</div>; })}</div>
    ),
  };
});

let params: Record<string, unknown> = { bucket: "30_45", label: "30–45 days" };
vi.mock("expo-router", () => ({ router: { back: vi.fn() }, useLocalSearchParams: () => params }));
const fetchDuesCustomers = vi.fn();
vi.mock("../../lib/dues", () => ({ fetchDuesCustomers: (b: string) => fetchDuesCustomers(b) }));
vi.mock("../../components/dues/dues-customer-row", () => ({ DuesCustomerRow: ({ customer }: { customer: { customerId: string } }) => <span>row-{customer.customerId}</span> }));
vi.mock("../../components/error-state", () => ({ ErrorState: () => <span>error-state</span> }));

import DuesBucketScreen from "./[bucket]";

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("DuesBucketScreen", () => {
  it("lists the bucket's customers (titled by label)", async () => {
    fetchDuesCustomers.mockResolvedValue({ customers: [{ customerId: "c1" }] });
    render(<DuesBucketScreen />);
    expect(screen.getByText("Dues · 30–45 days")).toBeInTheDocument();
    await flush();
    expect(screen.getByText("row-c1")).toBeInTheDocument();
  });

  it("shows the error state when the fetch fails", async () => {
    fetchDuesCustomers.mockResolvedValue(null);
    render(<DuesBucketScreen />);
    await flush();
    expect(screen.getByText("error-state")).toBeInTheDocument();
  });

  it("shows the empty state with no label/bucket and navigates back", async () => {
    params = {}; // no bucket → "" fallback; no label → "Dues"
    (router.back as ReturnType<typeof vi.fn>).mockClear();
    fetchDuesCustomers.mockResolvedValue({ customers: [] });
    render(<DuesBucketScreen />);
    expect(screen.getByText("Dues")).toBeInTheDocument();
    fireEvent.click(screen.getByText("←"));
    expect(router.back).toHaveBeenCalled();
    await flush();
    expect(screen.getByText("No customers in this bucket")).toBeInTheDocument();
    params = { bucket: "30_45", label: "30–45 days" };
  });
});
