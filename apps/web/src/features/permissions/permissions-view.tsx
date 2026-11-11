"use client";

import { useMemo, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type {
  ConfigurableRole,
  PermissionCatalogEntry,
  PermissionMatrix,
} from "./permissions-api";

const ROLES: ConfigurableRole[] = ["MANAGER", "ACCOUNTANT"];
const ROLE_LABEL: Record<ConfigurableRole, string> = {
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
};

type RoleState = Record<ConfigurableRole, Record<string, boolean>>;

function cloneState(roles: RoleState): RoleState {
  return { MANAGER: { ...roles.MANAGER }, ACCOUNTANT: { ...roles.ACCOUNTANT } };
}

export function PermissionsView({
  matrix,
  actionConfig,
}: {
  readonly matrix: PermissionMatrix;
  readonly actionConfig: ActionConfig;
}) {
  const [original, setOriginal] = useState<RoleState>(() => cloneState(matrix.roles));
  const [state, setState] = useState<RoleState>(() => cloneState(matrix.roles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const groups = useMemo(() => {
    const byGroup = new Map<string, PermissionCatalogEntry[]>();
    for (const entry of matrix.catalog) {
      const list = byGroup.get(entry.group) ?? [];
      list.push(entry);
      byGroup.set(entry.group, list);
    }
    return [...byGroup.entries()];
  }, [matrix.catalog]);

  const dirty = useMemo(() => {
    for (const role of ROLES) {
      for (const entry of matrix.catalog) {
        if (state[role][entry.key] !== original[role][entry.key]) return true;
      }
    }
    return false;
  }, [state, original, matrix.catalog]);

  function toggle(role: ConfigurableRole, key: string) {
    setSaved(false);
    setState((prev) => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role][key] } }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      for (const role of ROLES) {
        const entries = matrix.catalog
          .filter((e) => state[role][e.key] !== original[role][e.key])
          .map((e) => ({ key: e.key, allowed: state[role][e.key] }));
        if (entries.length > 0) {
          await apiRequest(actionConfig, "PUT", `/permissions/${role}`, { entries });
        }
      }
      // New saved baseline = current selections → clears the dirty state.
      setOriginal(cloneState(state));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e, "Couldn't save permissions."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Configure" }, { label: "Permissions" }]}
        title="Permissions"
        subtitle="Control what Managers and Accountants can access. Super Admin always has full access."
        action={
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {saved && !dirty ? <Check size={15} /> : null}
            {saved && !dirty ? "Saved" : "Save changes"}
          </button>
        }
      />

      {error ? (
        <div className="max-w-3xl rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="max-w-3xl overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Capability</th>
              {ROLES.map((role) => (
                <th key={role} className="w-28 px-4 py-2.5 text-center font-medium">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, entries]) => (
              <GroupRows key={group} group={group} entries={entries} state={state} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GroupRows({
  group,
  entries,
  state,
  onToggle,
}: {
  readonly group: string;
  readonly entries: PermissionCatalogEntry[];
  readonly state: RoleState;
  readonly onToggle: (role: ConfigurableRole, key: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-border bg-muted/20">
        <td colSpan={1 + ROLES.length} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {group}
        </td>
      </tr>
      {entries.map((entry) => (
        <tr key={entry.key} className="border-b border-border last:border-0">
          <td className="px-4 py-2 text-foreground">{entry.label}</td>
          {ROLES.map((role) => (
            <td key={role} className="px-4 py-2 text-center">
              <input
                type="checkbox"
                checked={state[role][entry.key] ?? false}
                onChange={() => onToggle(role, entry.key)}
                className="size-4 cursor-pointer accent-primary"
                aria-label={`${entry.label} for ${ROLE_LABEL[role]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
