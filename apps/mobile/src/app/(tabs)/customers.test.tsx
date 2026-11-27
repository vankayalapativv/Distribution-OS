import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

type ListProps = {
  data: unknown[];
  renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
  keyExtractor: (item: unknown, index: number) => string;
  getItemLayout?: (data: unknown, index: number) => unknown;
};
vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  // rnw's FlatList doesn't call renderItem/keyExtractor/getItemLayout under
  // jsdom (no layout pass) — stub it to invoke all three per row.
  return {
    ...actual,
    FlatList: ({ data, renderItem, keyExtractor, getItemLayout }: ListProps) => (
      <div>
        {data.map((item, index) => {
          keyExtractor(item, index);
          getItemLayout?.(data, index);
          return <div key={index}>{renderItem({ item, index })}</div>;
        })}
      </div>
    ),
  };
});

const useCustomerDirectory = vi.fn();
vi.mock("../../lib/customers/use-customer-directory", () => ({ useCustomerDirectory: () => useCustomerDirectory() }));
vi.mock("../../components/customers/az-index", () => ({ AzIndex: () => <span>az-index</span> }));
vi.mock("../../components/customers/customer-row", () => ({
  CustomerRow: ({ c }: { c: { id: string } }) => <span>row-{c.id}</span>,
  LetterHeader: ({ letter }: { letter: string }) => <span>hdr-{letter}</span>,
}));
vi.mock("../../components/customers/customers-skeleton", () => ({ CustomersSkeleton: () => <span>customers-skeleton</span> }));
vi.mock("../../components/customers/search-header", () => ({ SearchHeader: () => <span>search-header</span> }));
vi.mock("../../components/error-state", () => ({ ErrorState: ({ onRetry }: { onRetry: () => void }) => <button type="button" onClick={onRetry}>retry</button> }));

import CustomersScreen from "./customers";

const base = {
  customersQuery: { isPending: false, isError: false, error: null, refetch: vi.fn() },
  customers: [], rows: [], listRef: { current: null }, offsets: [], stickyHeaderIndices: [],
  searching: false, search: "", setSearch: vi.fn(), refreshing: false, onRefresh: vi.fn(),
  showIndex: false, presentLetters: [], jumpTo: vi.fn(),
};

describe("CustomersScreen", () => {
  it("shows the skeleton while pending", () => {
    useCustomerDirectory.mockReturnValue({ ...base, customersQuery: { ...base.customersQuery, isPending: true } });
    render(<CustomersScreen />);
    expect(screen.getByText("customers-skeleton")).toBeInTheDocument();
  });

  it("shows a retryable error on failure", () => {
    const refetch = vi.fn();
    useCustomerDirectory.mockReturnValue({ ...base, customersQuery: { isPending: false, isError: true, error: new Error("x"), refetch } });
    render(<CustomersScreen />);
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the no-results message while searching", () => {
    useCustomerDirectory.mockReturnValue({ ...base, searching: true, search: " acme " });
    render(<CustomersScreen />);
    expect(screen.getByText(/No customers match/)).toBeInTheDocument();
  });

  it("shows the empty-directory message", () => {
    useCustomerDirectory.mockReturnValue({ ...base });
    render(<CustomersScreen />);
    expect(screen.getByText(/No customers yet/)).toBeInTheDocument();
  });

  it("renders the A–Z list (header + customer rows) with the index", () => {
    useCustomerDirectory.mockReturnValue({
      ...base,
      rows: [
        { kind: "header", letter: "A" },
        { kind: "customer", customer: { id: "c1" } },
      ],
      offsets: [0], // index 1 offset undefined → `?? 0` fallback
      stickyHeaderIndices: [0],
      showIndex: true,
    });
    render(<CustomersScreen />);
    expect(screen.getByText("hdr-A")).toBeInTheDocument();
    expect(screen.getByText("row-c1")).toBeInTheDocument();
    expect(screen.getByText("az-index")).toBeInTheDocument();
  });

  it("hides the A–Z index when showIndex is false (filtered list uses the search key)", () => {
    useCustomerDirectory.mockReturnValue({
      ...base,
      rows: [{ kind: "customer", customer: { id: "c2" } }],
      offsets: [0],
      showIndex: false,
      searching: true, // list key → "search"
    });
    render(<CustomersScreen />);
    expect(screen.getByText("row-c2")).toBeInTheDocument();
    expect(screen.queryByText("az-index")).not.toBeInTheDocument();
  });
});
