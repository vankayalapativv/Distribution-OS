import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActorCell, roleLabel } from "./audit-actor";
import type { AuditLog } from "./audit-logs-api";

const log = (over: Partial<AuditLog> = {}): AuditLog => ({
  id: "a1", createdAt: "2026-07-28T05:21:00Z", actorUserId: "u1", actorName: "Asha",
  actorRole: "SUPER_ADMIN", action: "customer.update", entityType: "customer",
  entityId: "c1", entityLabel: "Acme", summary: "Updated address", metadata: null, ...over,
});

describe("roleLabel", () => {
  it("title-cases an underscore role code", () => {
    expect(roleLabel("SUPER_ADMIN")).toBe("Super Admin");
    expect(roleLabel("SALES_EXECUTIVE")).toBe("Sales Executive");
  });
  it("is empty for a null role", () => {
    expect(roleLabel(null)).toBe("");
  });
});

describe("ActorCell", () => {
  it("shows the name and a role pill", () => {
    render(<ActorCell log={log()} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });
  it("omits the pill when there is no role", () => {
    render(<ActorCell log={log({ actorRole: null })} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
  });
  it("falls back to a neutral tone for an unknown role", () => {
    render(<ActorCell log={log({ actorRole: "ROBOT" })} />);
    expect(screen.getByText("Robot").className).toContain("bg-muted");
  });
});
