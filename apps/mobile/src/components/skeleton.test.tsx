import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  BeatStopRowSkeleton,
  ContactRowSkeleton,
  DeliveryPickerRowSkeleton,
  DuesRowSkeleton,
  FormFieldSkeleton,
  LedgerRowSkeleton,
  ListRowSkeleton,
  NoteRowSkeleton,
  NotificationRowSkeleton,
  PdfPageSkeleton,
  PickerRowSkeleton,
  RecordRowSkeleton,
  Skeleton,
  SkeletonList,
  SkeletonTheme,
} from "./skeleton";
import { Skeleton as Block } from "./skeleton-block";
import { OrderDetailSkeleton } from "./order-detail-skeleton";
import { SegmentSalesSkeleton } from "./segment-sales-skeleton";
import { PhotoShimmer } from "./photo-shimmer";
import { Splash } from "./splash";

describe("Skeleton block", () => {
  it("renders a standalone block (owns its own sweep loop)", () => {
    const { container } = render(<Block width={120} height={20} radius={10} />);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("renders inside a SkeletonTheme (shares the provider's loop)", () => {
    const { container } = render(
      <SkeletonTheme>
        <Skeleton />
        <Skeleton width="50%" />
      </SkeletonTheme>,
    );
    expect(container.querySelectorAll("div").length).toBeGreaterThan(1);
  });
});

describe("row-shape skeletons", () => {
  const rows = [
    BeatStopRowSkeleton,
    ContactRowSkeleton,
    DeliveryPickerRowSkeleton,
    DuesRowSkeleton,
    FormFieldSkeleton,
    LedgerRowSkeleton,
    ListRowSkeleton,
    NoteRowSkeleton,
    NotificationRowSkeleton,
    PickerRowSkeleton,
    RecordRowSkeleton,
  ];
  it("every row shape renders without crashing", () => {
    for (const Row of rows) {
      const { container, unmount } = render(
        <SkeletonTheme>
          <Row />
        </SkeletonTheme>,
      );
      expect(container.querySelector("div")).not.toBeNull();
      unmount();
    }
  });
});

describe("composed skeletons", () => {
  it("SkeletonList renders N copies of the given row", () => {
    const { container } = render(<SkeletonList count={4} row={ListRowSkeleton} />);
    // 4 list rows, each an outer card div → at least 4 cards.
    expect(container.querySelectorAll("div").length).toBeGreaterThanOrEqual(4);
  });

  it("PdfPageSkeleton, OrderDetailSkeleton and SegmentSalesSkeleton render", () => {
    expect(render(<PdfPageSkeleton />).container.querySelector("div")).not.toBeNull();
    expect(render(<OrderDetailSkeleton />).container.querySelector("div")).not.toBeNull();
    expect(render(<SegmentSalesSkeleton />).container.querySelector("div")).not.toBeNull();
  });
});

describe("PhotoShimmer", () => {
  it("renders the shimmer with an optional caption", () => {
    const { queryByText, rerender } = render(<PhotoShimmer />);
    expect(queryByText(/./)).toBeNull(); // no label → no text
    rerender(<PhotoShimmer label="Preparing photo…" />);
    expect(queryByText("Preparing photo…")).not.toBeNull();
  });
});

describe("Splash", () => {
  it("renders a spinner inline and as an overlay", () => {
    expect(render(<Splash />).container.querySelector("div")).not.toBeNull();
    expect(render(<Splash overlay />).container.querySelector("div")).not.toBeNull();
  });
});
