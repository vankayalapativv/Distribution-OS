"use client";

/**
 * "Targets" card on the SA/Manager dashboard home: every active SE's target for
 * a chosen week/month — the current period (actual-vs-target) or any upcoming
 * one (target-only), navigable with a period switcher, with inline editing.
 */
import { withQueryClient } from "@/components/data-table/query-provider";
import { type ActionConfig } from "@/lib/api-client";
import { TargetEditDialog } from "./target-edit-dialog";
import { TargetsPanelHeader } from "./targets-panel-header";
import { TargetsExecList } from "./targets-exec-list";
import { PasteAllDialog } from "./paste-all-dialog";
import { useTargetsPanel } from "./use-targets-panel";

function TargetsPanelInner({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const p = useTargetsPanel(actionConfig);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <TargetsPanelHeader p={p} />
      <TargetsExecList p={p} />

      {p.editing ? (
        <TargetEditDialog
          actionConfig={actionConfig}
          executive={p.editing}
          period={p.period}
          periodStart={p.startStr}
          isFuture={p.isFuture}
          clipboard={p.clipboard}
          onCopy={p.setClipboard}
          onClose={() => p.setEditing(null)}
        />
      ) : null}

      <PasteAllDialog p={p} />
    </section>
  );
}

export const TargetsPanel = withQueryClient(TargetsPanelInner);
