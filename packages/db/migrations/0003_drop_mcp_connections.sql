-- The outbound MCP connection registry (0002) was removed: the app only exposes
-- itself as an MCP server (inbound), it does not connect out to other MCP
-- servers. Drop the now-unused, empty table. Idempotent and safe — no feature
-- reads it any more. (Inbound config lives in the MCP Worker's Durable Object,
-- not in this database.)
DROP TABLE IF EXISTS public.mcp_connections;
