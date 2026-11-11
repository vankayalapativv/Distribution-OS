import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { auditColumns, auditSkeleton } from "./audit-logs-columns";
import type { AuditLog } from "./audit-logs-api";

const log = (over: Partial<AuditLog> = {}): AuditLog => ({
  id: "a1", createdAt: "2026-07-28T05:21:00Z", actorUserId: "u1", actorName: "Asha",
  actorRole: "MANAGER", action: "customer.update", entityType: "customer",
  entityId: "c1", entityLabel: "Acme", summary: "Updated address", metadata: null, ...over,
});

type CellFn = (ctx: { row: { original: AuditLog }; getValue: () => unknown }) => ReactNode;
function renderCell(col: ColumnDef<AuditLog>, row: AuditLog) {
  const { cell, accessorKey } = col as { cell: CellFn; accessorKey?: keyof AuditLog };
  return render(<>{cell({ row: { original: row }, getValue: () => (accessorKey ? row[accessorKey] : undefined) })}</>);
}
const byId = (id: string) =>
  auditColumns.find((c) => (c as { id?: string }).id === id || (c as { accessorKey?: string }).accessorKey === id)!;

describe("auditColumns", () => {
  it("has five columns with a matching skeleton", () => {
    expect(auditColumns).toHaveLength(5);
    expect(auditSkeleton).toHaveLength(5);
  });

  it("formats the timestamp, action pill and summary", () => {
    renderCell(byId("createdAt"), log());
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    renderCell(byId("action"), log());
    expect(screen.getByText("customer.update")).toBeInTheDocument();
    renderCell(byId("summary"), log());
    expect(screen.getByText("Updated address")).toBeInTheDocument();
  });

  it("renders the record with label + type, and a dash when both are absent", () => {
    const { unmount } = renderCell(byId("record"), log());
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("customer")).toBeInTheDocument();
    unmount();
    renderCell(byId("record"), log({ entityLabel: null, entityType: null }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the record with only a type, or only a label", () => {
    const { unmount } = renderCell(byId("record"), log({ entityLabel: null, entityType: "invoice" }));
    expect(screen.getByText("invoice")).toBeInTheDocument();
    unmount();
    renderCell(byId("record"), log({ entityLabel: "INV-9", entityType: null }));
    expect(screen.getByText("INV-9")).toBeInTheDocument();
  });

  it("renders the actor via the Who column", () => {
    renderCell(byId("actorName"), log());
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
  });

  it("skeleton cells render", () => {
    expect(auditSkeleton.length).toBeGreaterThan(0);
    auditSkeleton.forEach((c) => {
      const { container, unmount } = render(<>{c()}</>);
      expect(container.firstChild).not.toBeNull();
      unmount();
    });
  });
});
