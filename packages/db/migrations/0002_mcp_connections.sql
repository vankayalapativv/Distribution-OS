-- Outbound MCP connection registry (managed from Settings → MCP, SUPER_ADMIN +
-- MANAGER). Each row is a remote MCP server this deployment can connect OUT to:
-- name + URL + transport + optional bearer auth. The app health-checks them and
-- can list their tools live. Idempotent so it is safe on the shared prod DB.
--
-- The INBOUND server (apps/mcp) keeps its own config (enabled flag + passphrase
-- hash) inside a Durable Object, so nothing inbound is stored here.
--
-- `auth_token` is a write-only secret: it is NEVER returned to the browser (the
-- API exposes only `hasAuth`), mirroring how user passwords are handled.

CREATE TABLE IF NOT EXISTS public.mcp_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    transport text DEFAULT 'streamable_http'::text NOT NULL,
    auth_type text DEFAULT 'none'::text NOT NULL,
    auth_token text,
    enabled boolean DEFAULT true NOT NULL,
    status text DEFAULT 'unknown'::text NOT NULL,
    last_checked_at timestamp with time zone,
    last_error text,
    last_tool_count integer,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_connections_pkey PRIMARY KEY (id),
    CONSTRAINT mcp_connections_transport_check CHECK (transport IN ('streamable_http', 'sse')),
    CONSTRAINT mcp_connections_auth_type_check CHECK (auth_type IN ('none', 'bearer')),
    CONSTRAINT mcp_connections_status_check CHECK (status IN ('unknown', 'online', 'offline', 'error'))
);

-- created_by → users(id); keep the row if the creator is ever removed (history).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mcp_connections_created_by_fkey'
    ) THEN
        ALTER TABLE public.mcp_connections
            ADD CONSTRAINT mcp_connections_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS mcp_connections_enabled_idx ON public.mcp_connections (enabled);
CREATE INDEX IF NOT EXISTS mcp_connections_created_at_idx ON public.mcp_connections (created_at DESC);
