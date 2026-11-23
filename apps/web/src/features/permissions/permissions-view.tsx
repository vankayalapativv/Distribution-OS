"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { PermissionMatrix } from "./permissions-api";
import { RolePanel } from "./role-panel";
import {
  changedEntries,
  cloneState,
  presetMap,
  ROLES,
  type PresetId,
  type RoleState,
} from "./permissions-presets";
import type { ConfigurableRole } from "./permissions-api";

export function PermissionsView({
  matrix,
  actionConfig,
}: {
  readonly matrix: PermissionMatrix;
  readonly actionConfig: ActionConfig;
}) {
  const [original, setOriginal] = useState<RoleState>(() => cloneState(matrix.roles));
  const [state, setState] = useState<RoleState>(() => cloneState(matrix.roles));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pending = useMemo(
    () =>
      ROLES.reduce((n, role) => n + changedEntries(state[role], original[role], matrix.catalog).length, 0),
    [state, original, matrix.catalog],
  );
  const dirty = pending > 0;

  function toggle(role: ConfigurableRole, key: string) {
    setSaved(false);
    setState((prev) => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role][key] } }));
  }

  function applyPreset(role: ConfigurableRole, preset: PresetId) {
    setSaved(false);
    setState((prev) => ({ ...prev, [role]: presetMap(preset, role, matrix.catalog) }));
  }

  function discard() {
    setSaved(false);
    setError(null);
    setState(cloneState(original));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      for (const role of ROLES) {
        const entries = changedEntries(state[role], original[role], matrix.catalog);
        if (entries.length > 0) {
          await apiRequest(actionConfig, "PUT", `/permissions/${role}`, { entries });
        }
      }
      setOriginal(cloneState(state));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e, "Couldn't save permissions."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Configure" }, { label: "Permissions" }]}
        title="Permissions"
        subtitle="Control what Managers and Accountants can access. Super Admin always has full access."
        action={
          <div className="flex items-center gap-2">
            {dirty ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={discard}>
                Discard
              </Button>
            ) : null}
            <Button size="sm" disabled={!dirty || busy} onClick={save}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {saved && !dirty ? <Check /> : null}
              {saved && !dirty ? "Saved" : dirty ? `Save ${pending} change${pending === 1 ? "" : "s"}` : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search capabilities…"
            className="pl-8"
            aria-label="Search capabilities"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ROLES.map((role) => (
            <RolePanel
              key={role}
              role={role}
              catalog={matrix.catalog}
              map={state[role]}
              base={original[role]}
              query={query}
              onToggle={toggle}
              onPreset={applyPreset}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
