import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AgentLevel } from "./metrics-drilldown-agents";
import { CustomerLevel } from "./metrics-drilldown-customers";
import type { MetricKey } from "./metrics-helpers";

/**
 * The drill-down loading states render a CONTEXT-AWARE shimmer (an aria-hidden
 * container of 6 skeleton rows shaped for the metric), not the old "Loading…"
 * text. These tests assert every level + metric renders that skeleton without
 * throwing, so a regression that drops the shimmer is caught.
 */
const skeletonOf = (el: HTMLElement) => el.querySelector('[aria-hidden="true"]');

describe("drill-down context-aware shimmer", () => {
  test("executives list shows a 6-row skeleton while loading", () => {
    const { container } = render(
      <AgentLevel metric="visits" agents={null} onOpen={() => {}} />,
    );
    const skel = skeletonOf(container);
    expect(skel).not.toBeNull();
    expect(skel!.children).toHaveLength(6);
    expect(container.textContent).not.toContain("Loading");
  });

  const metrics: MetricKey[] = [
    "executives",
    "visits",
    "productive",
    "litres",
    "collections",
  ];

  test.each(metrics)("customer rows show a 6-row %s skeleton while loading", (metric) => {
    const { container } = render(<CustomerLevel metric={metric} rows={null} />);
    const skel = skeletonOf(container);
    expect(skel).not.toBeNull();
    expect(skel!.children).toHaveLength(6);
    expect(container.textContent).not.toContain("Loading");
  });
});
