"use client";

import { withQueryClient } from "@/components/data-table/query-provider";
import type { ActionConfig } from "@/lib/api-client";
import { PanelHeader } from "./settings-shared";
import { McpConnectorCard } from "./settings-mcp-connector";

function McpPanelInner({ actionConfig }: Readonly<{ actionConfig: ActionConfig }>) {
  return (
    <div>
      <PanelHeader
        title="MCP"
        subtitle="Model Context Protocol — let Claude (and other AI clients) connect to your company's data, read-only. Your data stays private to your company."
      />
      <McpConnectorCard actionConfig={actionConfig} />
    </div>
  );
}

export const McpPanel = withQueryClient(McpPanelInner);
