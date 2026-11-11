-- Per-enterprise MCP access (Phase 4).
--
-- Each enterprise gets its own MCP passphrase. A connector sends one secret; the
-- MCP worker SHA-256s it and resolves it to an enterprise_id, then runs every
-- run_sql under the app_readonly role with app.enterprise_id set, so Postgres RLS
-- scopes results to that enterprise (the same isolation the app uses).
--
-- The passphrase is stored only as its SHA-256 (never plaintext — shown once at
-- generation, like the user 'Set password' flow). `enabled` lets an enterprise
-- turn its own MCP access off without clearing the secret.

CREATE TABLE public.enterprise_mcp_config (
    enterprise_id uuid PRIMARY KEY REFERENCES public.enterprises(id) ON DELETE CASCADE,
    passphrase_sha256 text UNIQUE,            -- hex SHA-256 of the passphrase; null = none set
    passphrase_set_at timestamptz,
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid                           -- the SUPER_ADMIN who set it
);

-- RLS so a web admin manages ONLY their own enterprise's row (same model as the
-- rest of the app; the owner bypasses for the control plane).
ALTER TABLE public.enterprise_mcp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY enterprise_isolation ON public.enterprise_mcp_config
  USING (enterprise_id = public.app_current_enterprise_id())
  WITH CHECK (enterprise_id = public.app_current_enterprise_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_mcp_config TO app_tenant;
GRANT SELECT ON public.enterprise_mcp_config TO app_readonly;

-- Resolver: the MCP worker calls this with the submitted passphrase's SHA-256 to
-- learn which enterprise it belongs to — BEFORE any enterprise scope exists.
-- SECURITY DEFINER runs as the table owner so it bypasses RLS to find the match,
-- but it ONLY ever returns the enterprise_id for an EXACT hash on an ENABLED row
-- (no enumeration: a high-entropy passphrase's SHA-256 can't be guessed). It
-- never exposes the hash list or any business data.
CREATE FUNCTION public.mcp_resolve_enterprise(p_hash text) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT enterprise_id
    FROM public.enterprise_mcp_config
    WHERE passphrase_sha256 = p_hash AND enabled
    LIMIT 1
  $$;

REVOKE ALL ON FUNCTION public.mcp_resolve_enterprise(text) FROM public;
GRANT EXECUTE ON FUNCTION public.mcp_resolve_enterprise(text) TO app_readonly, app_tenant;
