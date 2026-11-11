"use client";

import { withQueryClient } from "@/components/data-table/query-provider";
import type { ActionConfig } from "@/lib/api-client";
import { PanelHeader } from "./settings-shared";
import { McpInboundCard } from "./settings-mcp-inbound";

function McpPanelInner({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  return (
    <div>
      <PanelHeader
        title="MCP"
        subtitle="Model Context Protocol — let Claude (and other AI clients) connect to this app's data, read-only."
      />
      <McpInboundCard actionConfig={actionConfig} />
    </div>
  );
}

export const McpPanel = withQueryClient(McpPanelInner);
