import { describe, expect, it } from "vitest";
import type { PermissionCatalogEntry } from "./permissions-api";
import {
  changedEntries,
  cloneState,
  diffCounts,
  enabledCount,
  PRESETS,
  presetMap,
  ROLE_LABEL,
  ROLES,
  type RoleState,
} from "./permissions-presets";

const catalog: PermissionCatalogEntry[] = [
  { key: "section:customers", kind: "section", label: "Customers", group: "Sections", defaults: { MANAGER: true, ACCOUNTANT: true } },
  { key: "section:invoices", kind: "section", label: "Invoices", group: "Sections", defaults: { MANAGER: false, ACCOUNTANT: true } },
  { key: "action:orders.create", kind: "action", label: "Create orders", group: "Actions", defaults: { MANAGER: true, ACCOUNTANT: false } },
];

describe("permissions-presets", () => {
  it("exposes both configurable roles with labels and four presets", () => {
    expect(ROLES).toEqual(["MANAGER", "ACCOUNTANT"]);
    expect(ROLE_LABEL.MANAGER).toBe("Manager");
    expect(PRESETS.map((p) => p.id)).toEqual(["defaults", "full", "readonly", "none"]);
  });

  it("cloneState makes an independent copy", () => {
    const state: RoleState = { MANAGER: { a: true }, ACCOUNTANT: { a: false } };
    const copy = cloneState(state);
    copy.MANAGER.a = false;
    expect(state.MANAGER.a).toBe(true); // original untouched
    expect(copy.ACCOUNTANT).not.toBe(state.ACCOUNTANT);
  });

  it("presetMap: defaults uses each role's catalog default", () => {
    expect(presetMap("defaults", "MANAGER", catalog)).toEqual({
      "section:customers": true,
      "section:invoices": false,
      "action:orders.create": true,
    });
    expect(presetMap("defaults", "ACCOUNTANT", catalog)["action:orders.create"]).toBe(false);
  });

  it("presetMap: full enables all, none disables all", () => {
    expect(Object.values(presetMap("full", "MANAGER", catalog)).every(Boolean)).toBe(true);
    expect(Object.values(presetMap("none", "MANAGER", catalog)).some(Boolean)).toBe(false);
  });

  it("presetMap: readonly enables sections only", () => {
    expect(presetMap("readonly", "MANAGER", catalog)).toEqual({
      "section:customers": true,
      "section:invoices": true,
      "action:orders.create": false,
    });
  });

  it("enabledCount counts truthy entries", () => {
    expect(enabledCount({ "section:customers": true, "section:invoices": false, "action:orders.create": true }, catalog)).toBe(2);
    expect(enabledCount({}, catalog)).toBe(0);
  });

  it("diffCounts reports additions and removals vs a baseline", () => {
    const base = { "section:customers": true, "section:invoices": false, "action:orders.create": true };
    const next = { "section:customers": true, "section:invoices": true, "action:orders.create": false };
    expect(diffCounts(next, base, catalog)).toEqual({ added: 1, removed: 1 });
    expect(diffCounts(base, base, catalog)).toEqual({ added: 0, removed: 0 });
  });

  it("treats keys missing from a map as disabled", () => {
    const base = { "section:customers": true, "section:invoices": false, "action:orders.create": true };
    // An empty map => every catalog key reads as false.
    expect(diffCounts({}, base, catalog)).toEqual({ added: 0, removed: 2 });
    expect(changedEntries({}, base, catalog)).toEqual([
      { key: "section:customers", allowed: false },
      { key: "action:orders.create", allowed: false },
    ]);
    // A missing BASELINE key also reads as false.
    expect(diffCounts({ "section:customers": true }, {}, catalog)).toEqual({ added: 1, removed: 0 });
    expect(changedEntries({ "section:customers": true }, {}, catalog)).toEqual([
      { key: "section:customers", allowed: true },
    ]);
  });

  it("changedEntries returns only the differing keys as a PUT payload", () => {
    const base = { "section:customers": true, "section:invoices": false, "action:orders.create": true };
    const next = { "section:customers": true, "section:invoices": true, "action:orders.create": true };
    expect(changedEntries(next, base, catalog)).toEqual([{ key: "section:invoices", allowed: true }]);
    expect(changedEntries(base, base, catalog)).toEqual([]);
  });
});
