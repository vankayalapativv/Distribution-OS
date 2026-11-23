import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PermissionCatalogEntry } from "./permissions-api";
import { RolePanel } from "./role-panel";

const catalog: PermissionCatalogEntry[] = [
  { key: "section:customers", kind: "section", label: "Customers", group: "Sections", defaults: { MANAGER: true, ACCOUNTANT: true } },
  { key: "section:invoices", kind: "section", label: "Invoices", group: "Sections", defaults: { MANAGER: false, ACCOUNTANT: true } },
  { key: "action:orders.create", kind: "action", label: "Create orders", group: "Actions", defaults: { MANAGER: true, ACCOUNTANT: false } },
];

const base = { "section:customers": true, "section:invoices": false, "action:orders.create": true };

const renderPanel = (
  over: { map?: Record<string, boolean>; query?: string } = {},
  h: { onToggle?: () => void; onPreset?: () => void } = {},
) => {
  const onToggle = h.onToggle ?? vi.fn();
  const onPreset = h.onPreset ?? vi.fn();
  render(
    <RolePanel
      role="MANAGER"
      catalog={catalog}
      map={over.map ?? base}
      base={base}
      query={over.query ?? ""}
      onToggle={onToggle}
      onPreset={onPreset}
    />,
  );
  return { onToggle, onPreset };
};

describe("RolePanel", () => {
  it("shows the role, the enable meter and both capability groups", () => {
    renderPanel();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("toggling a row calls onToggle with the role and key", () => {
    const { onToggle } = renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Customers for Manager" }));
    expect(onToggle).toHaveBeenCalledWith("MANAGER", "section:customers");
  });

  it("shows an unsaved +/- summary when the map differs from the baseline", () => {
    renderPanel({ map: { ...base, "section:invoices": true } });
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("shows a removed (−) summary when a grant is turned off", () => {
    renderPanel({ map: { ...base, "section:customers": false } });
    expect(screen.getByText("−1")).toBeInTheDocument();
  });

  it("filters the capability rows by the search query", () => {
    renderPanel({ query: "invoice" });
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.queryByText("Customers")).not.toBeInTheDocument();
  });

  it("renders the empty state when the query matches nothing", () => {
    renderPanel({ query: "zzz" });
    expect(screen.getByText("No capabilities match.")).toBeInTheDocument();
  });

  it("treats a baseline missing keys as all-off (every enabled row reads as changed)", () => {
    render(
      <RolePanel
        role="MANAGER"
        catalog={catalog}
        map={base}
        base={{}}
        query=""
        onToggle={vi.fn()}
        onPreset={vi.fn()}
      />,
    );
    // base {} => the two enabled grants count as additions.
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders a zeroed meter and empty state for an empty catalog", () => {
    render(
      <RolePanel role="MANAGER" catalog={[]} map={{}} base={{}} query="" onToggle={vi.fn()} onPreset={vi.fn()} />,
    );
    expect(screen.getByText("0 of 0 enabled")).toBeInTheDocument();
    expect(screen.getByText("No capabilities match.")).toBeInTheDocument();
  });

  it("treats a map missing keys as off", () => {
    render(
      <RolePanel role="MANAGER" catalog={catalog} map={{}} base={{}} query="" onToggle={vi.fn()} onPreset={vi.fn()} />,
    );
    expect(screen.getByRole("switch", { name: "Customers for Manager" })).toHaveAttribute("aria-checked", "false");
  });

  it("fires onPreset from the preset menu and the quick actions", () => {
    const { onPreset } = renderPanel();
    fireEvent.click(screen.getByText("Enable all"));
    expect(onPreset).toHaveBeenCalledWith("MANAGER", "full");

    fireEvent.click(screen.getByText("Clear"));
    expect(onPreset).toHaveBeenCalledWith("MANAGER", "none");

    fireEvent.click(screen.getByRole("button", { name: /Preset/ }));
    fireEvent.click(screen.getByText("Read-only"));
    expect(onPreset).toHaveBeenCalledWith("MANAGER", "readonly");
  });
});
