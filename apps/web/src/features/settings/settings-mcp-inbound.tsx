"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { type ActionConfig, errorMessage } from "@/lib/api-client";
import { getServer, getServerAudit, type InboundStatus, patchServer } from "./settings-mcp-api";

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

/** The collapsible "recent query activity" list (loading / entries / empty). */
function AuditEntries({ isLoading, data }: Readonly<{
  isLoading: boolean;
  data: Awaited<ReturnType<typeof getServerAudit>> | undefined;
}>) {
  if (isLoading) return <p className="p-3 text-xs text-muted-foreground">Loading…</p>;
  if (!data || data.entries.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">No queries recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-border/70 text-xs">
      {data.entries.map((e) => (
        <li key={`${e.ts}-${e.sql}`} className="flex items-start gap-2 p-2.5">
          <span className={`mt-0.5 size-2 shrink-0 rounded-full ${e.ok ? "bg-green-500" : "bg-red-500"}`} />
          <code className="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={e.sql}>{e.sql}</code>
          <span className="shrink-0 text-muted-foreground">{e.rowCount ?? "—"} rows</span>
        </li>
      ))}
    </ul>
  );
}

export function McpInboundCard({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  const qc = useQueryClient();
  // null = not editing (mirror the server value); string = an edited draft.
  const [draft, setDraft] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mcp", "server"],
    queryFn: () => getServer(actionConfig),
  });

  const audit = useQuery({
    queryKey: ["mcp", "server", "audit"],
    queryFn: () => getServerAudit(actionConfig, 25),
    enabled: showAudit,
  });

  const mutate = useMutation({
    mutationFn: (body: { enabled?: boolean; passphrase?: string | null }) => patchServer(actionConfig, body),
    onSuccess: (next: InboundStatus) => {
      qc.setQueryData(["mcp", "server"], next);
      setDraft(null);
      setMsg({ type: "success", text: "Saved." });
    },
    onError: (e) => setMsg({ type: "error", text: errorMessage(e, "Failed to save.") }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (isError || !data) {
    return <p className="py-6 text-sm text-red-600">{errorMessage(error, "Could not load the MCP server status.")}</p>;
  }
  if (!data.configured) {
    return (
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-medium">Server not connected to this app yet.</p>
        <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
          Set <code className="font-mono">MCP_SERVER_ORIGIN</code> and <code className="font-mono">MCP_ADMIN_SECRET</code> on the API to manage it here.
        </p>
      </div>
    );
  }

  const busy = mutate.isPending;
  const passValue = draft ?? data.passphrase ?? "";

  return (
    <div className="space-y-5">
      {/* Status + on/off */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Server size={18} /></span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">This app as an MCP server</span>
              <StatusBadge
                status={data.enabled ? "on" : "off"}
                tones={{ on: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", off: "bg-muted text-muted-foreground" }}
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.enabled ? "AI clients can connect with the passphrase below." : "Turned off — no one can connect."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={data.enabled ? "outline" : "default"}
          size="sm"
          disabled={busy}
          onClick={() => { setMsg(null); mutate.mutate({ enabled: !data.enabled }); }}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {data.enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>

      {/* Connection address */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Connection address</label>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-2 font-mono text-xs">{data.mcpEndpoint ?? "—"}</code>
          <CopyButton value={data.mcpEndpoint ?? ""} label="Copy address" />
        </div>
      </div>

      {/* Passphrase — shown in full so it can be shared */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Passphrase</label>
        <div className="flex items-center gap-2">
          <Input
            value={passValue}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={data.usingEnvFallback ? "Set a passphrase to manage it here" : "Set a passphrase"}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <CopyButton value={passValue} label="Copy passphrase" />
          <Button
            type="button"
            size="sm"
            disabled={busy || draft === null || draft.trim().length < 8}
            onClick={() => { setMsg(null); mutate.mutate({ passphrase: (draft ?? "").trim() }); }}
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI clients enter this to connect. Share it only with people who should have access.
          {data.usingEnvFallback && " A passphrase is already active on the server; set one here to see and manage it."}
        </p>
      </div>

      {/* How to connect */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">How to connect from Claude</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Claude → Settings → Connectors → <span className="font-medium">Add custom connector</span>.</li>
          <li>Paste the connection address above; leave the other fields blank.</li>
          <li>Connect, then enter the passphrase when asked.</li>
        </ol>
      </div>

      {/* Recent activity (optional, collapsed) */}
      <div>
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowAudit((v) => !v)}>
          {showAudit ? "Hide" : "Show"} recent query activity{data.auditCount !== null ? ` (${data.auditCount})` : ""}
        </button>
        {showAudit && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
            <AuditEntries isLoading={audit.isLoading} data={audit.data} />
          </div>
        )}
      </div>

      {msg && <p className={`text-xs ${msg.type === "success" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
