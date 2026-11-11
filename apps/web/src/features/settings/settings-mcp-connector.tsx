"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { type ActionConfig, errorMessage } from "@/lib/api-client";
import {
  generatePassphrase,
  getPassphrase,
  type McpPassphraseStatus,
  setPassphraseEnabled,
} from "./settings-mcp-api";

function CopyButton({ value, label }: Readonly<{ value: string; label: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      disabled={!value}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="text-green-600" /> : <Copy />}
    </Button>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function McpConnectorCard({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  const qc = useQueryClient();
  // The one-time plaintext passphrase, held only until the admin dismisses it.
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mcp", "passphrase"],
    queryFn: () => getPassphrase(actionConfig),
  });

  const gen = useMutation({
    mutationFn: () => generatePassphrase(actionConfig),
    onSuccess: (r) => {
      setNewSecret(r.passphrase);
      setMsg(null);
      void qc.invalidateQueries({ queryKey: ["mcp", "passphrase"] });
    },
    onError: (e) => setMsg({ type: "error", text: errorMessage(e, "Could not generate a passphrase.") }),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setPassphraseEnabled(actionConfig, enabled),
    onSuccess: (next: McpPassphraseStatus) => {
      qc.setQueryData(["mcp", "passphrase"], next);
      setMsg({ type: "success", text: next.enabled ? "MCP access enabled." : "MCP access disabled." });
    },
    onError: (e) => setMsg({ type: "error", text: errorMessage(e, "Could not update access.") }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (isError || !data) {
    const is403 = error instanceof Error && /403|forbidden|super ?admin/i.test(error.message);
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {is403 ? "Only a Super Admin can manage MCP access for your company." : errorMessage(error, "Could not load MCP access.")}
      </p>
    );
  }

  const busy = gen.isPending || toggle.isPending;

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">AI access to your company data</span>
            <StatusBadge
              status={data.passphraseSet && data.enabled ? "on" : "off"}
              tones={{
                on: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                off: "bg-muted text-muted-foreground",
              }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {!data.passphraseSet
              ? "Not set up — generate a passphrase to let an AI client connect, read-only."
              : data.enabled
                ? `Enabled — connectors with the passphrase can read your data. Set ${fmtDate(data.passphraseSetAt)}.`
                : "Disabled — no connector can reach your data, even with the passphrase."}
          </p>
        </div>
        {data.passphraseSet && (
          <Button
            type="button"
            variant={data.enabled ? "outline" : "default"}
            size="sm"
            disabled={busy}
            onClick={() => { setMsg(null); toggle.mutate(!data.enabled); }}
          >
            {toggle.isPending ? <Loader2 className="animate-spin" /> : null}
            {data.enabled ? "Disable" : "Enable"}
          </Button>
        )}
      </div>

      {/* One-time passphrase reveal (right after generating) */}
      {newSecret && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">Your new passphrase — copy it now</p>
          <p className="text-xs text-muted-foreground">
            This is shown only once and can&apos;t be retrieved again. Paste it into your AI client, then keep it somewhere safe.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2.5 py-2 font-mono text-sm">{newSecret}</code>
            <CopyButton value={newSecret} label="Copy passphrase" />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setNewSecret(null)}>I&apos;ve saved it</Button>
        </div>
      )}

      {/* Connection address */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Connection address</label>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-2 font-mono text-xs">
            {data.mcpEndpoint ?? "Not configured on this environment"}
          </code>
          <CopyButton value={data.mcpEndpoint ?? ""} label="Copy address" />
        </div>
      </div>

      {/* Generate / rotate */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Passphrase</label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => { setMsg(null); gen.mutate(); }}>
            {gen.isPending ? <Loader2 className="animate-spin" /> : null}
            {data.passphraseSet ? "Regenerate passphrase" : "Generate passphrase"}
          </Button>
          {data.passphraseSet && (
            <span className="text-xs text-muted-foreground">
              A passphrase is set (hidden). Regenerating replaces it — existing connectors stop working until updated.
            </span>
          )}
        </div>
      </div>

      {/* How to connect */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">How to connect from Claude</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Claude → Settings → Connectors → <span className="font-medium">Add custom connector</span>.</li>
          <li>Paste the connection address above; leave the other fields blank.</li>
          <li>Connect, then enter your passphrase when asked.</li>
        </ol>
      </div>

      {msg && <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
