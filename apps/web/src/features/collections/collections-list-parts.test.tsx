import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionsEmpty, CollectionsSubtitle } from "./collections-list-parts";

describe("CollectionsSubtitle", () => {
  it("shows a pluralised count and the pending badge", () => {
    render(<CollectionsSubtitle total={3} isLoading={false} pendingCount={2} />);
    expect(screen.getByText("3 collections")).toBeInTheDocument();
    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });

  it("shows Loading… and hides the badge when none pending", () => {
    render(<CollectionsSubtitle total={0} isLoading pendingCount={0} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
  });

  it("uses the singular for one collection", () => {
    render(<CollectionsSubtitle total={1} isLoading={false} pendingCount={0} />);
    expect(screen.getByText("1 collection")).toBeInTheDocument();
  });
});

describe("CollectionsEmpty", () => {
  it("shows the filtered-empty message when filters are active", () => {
    render(<CollectionsEmpty hasFilters canCreate onCreate={() => {}} />);
    expect(screen.getByText("No collections match your filters.")).toBeInTheDocument();
  });

  it("offers a create button on a truly empty list when allowed", () => {
    const onCreate = vi.fn();
    render(<CollectionsEmpty hasFilters={false} canCreate onCreate={onCreate} />);
    fireEvent.click(screen.getByText("Record first collection"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("hides the create button when not allowed", () => {
    render(<CollectionsEmpty hasFilters={false} canCreate={false} onCreate={() => {}} />);
    expect(screen.getByText(/No collections recorded yet/)).toBeInTheDocument();
    expect(screen.queryByText("Record first collection")).not.toBeInTheDocument();
  });
});
