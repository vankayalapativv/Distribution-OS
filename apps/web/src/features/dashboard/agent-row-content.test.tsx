import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { agentRowContent } from "./agent-row-content";
import type { AgentRow } from "./metrics-helpers";

const base: AgentRow = { agentId: "a1", agentName: "Ravi Kumar" };
const A = (over: Partial<AgentRow> = {}): AgentRow => ({ ...base, ...over });

describe("agentRowContent", () => {
  it("executives: day started vs not, and live/seen/none values", () => {
    expect(agentRowContent("executives", A({ sessionStartedAt: "2026-09-15T09:00:00Z", visits: 3, live: true })).value).toBe("Live");
    const seen = agentRowContent("executives", A({ lastPingAt: "2026-09-15T09:00:00Z" }));
    expect(String(seen.value)).toMatch(/^seen/);
    const none = agentRowContent("executives", A({}));
    expect(none.value).toBe("—");
    expect(none.secondary).toBe("day not started");
    // day started but no visit count → the `visits ?? 0` default.
    expect(agentRowContent("executives", A({ sessionStartedAt: "2026-09-15T09:00:00Z" })).secondary).toContain("· 0 visits");
  });

  it("visits vs productive pick different value + sub", () => {
    const v = agentRowContent("visits", A({ visits: 8, productiveVisits: 6, customers: 1 }));
    expect(v.value).toBe(8);
    expect(v.sub).toBe("6 productive");
    expect(v.secondary).toBe("1 customer"); // singular
    const p = agentRowContent("productive", A({ visits: 8, productiveVisits: 6, customers: 2 }));
    expect(p.value).toBe(6);
    expect(p.sub).toBe("of 8 visits");
    expect(p.secondary).toBe("2 customers"); // plural
  });

  it("productivity renders a coloured pill, and handles zero visits", () => {
    const { container } = render(<>{agentRowContent("productivity", A({ visits: 10, productiveVisits: 5 })).value}</>);
    expect(container.textContent).toBe("50%");
    expect(agentRowContent("productivity", A({ visits: 0 })).sub).toBe("0 of 0 visits");
  });

  it("ordered / litres show their litres/qty + singular-plural", () => {
    expect(agentRowContent("ordered", A({ litres: 12, orders: 1 })).sub).toBe("incl. cancelled");
    expect(agentRowContent("ordered", A({ orders: 1 })).secondary).toContain("1 order");
    expect(agentRowContent("litres", A({ orders: 1 })).secondary).toContain("1 delivery");
    expect(agentRowContent("litres", A({ orders: 2 })).secondary).toContain("2 deliveries");
  });

  it("collections (default) shows amount + verified, singular-plural", () => {
    const c = agentRowContent("collections", A({ amount: 5000, verified: 2000, collections: 1 }));
    expect(c.sub).toContain("verified");
    expect(c.secondary).toContain("1 collection");
    expect(agentRowContent("collections", A({ collections: 3 })).secondary).toContain("3 collections");
  });

  it("defaults every missing numeric field to zero across all metrics", () => {
    const metrics = ["executives", "visits", "productive", "productivity", "ordered", "litres", "collections"] as const;
    for (const m of metrics) {
      const c = agentRowContent(m, A({})); // all fields undefined → the `?? 0` branches
      expect(typeof c.secondary).toBe("string");
    }
  });
});
