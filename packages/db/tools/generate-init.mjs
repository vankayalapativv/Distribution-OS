// Distribution OS — consolidated schema generator (Phase 2).
//
// Reads the introspected Sri Aparajita live schema (_source-schema.sql, a
// `pg_dump --schema-only` of the current single-tenant DB) and emits ONE
// consolidated migration `migrations/0001_init.sql` that is the multi-enterprise
// baseline: enterprise_id baked into every scoped table, natural-key uniques
// made composite, new foundation tables (enterprises + control-plane +
// onboarding), and Postgres RLS (enable + FORCE + per-table isolation policy).
//
// Deterministic + re-runnable. Does NOT touch any database. Run:
//   node packages/db/tools/generate-init.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "_source-schema.sql");
const OUT = join(here, "..", "migrations", "0001_init.sql");

// ── Classification (locked with the owner 2026-11-11) ───────────────────────
// Global / never enterprise-scoped (left exactly as today):
const GLOBAL = new Set([
  "roles",
  "role_permissions",
  "error_events", // Error Monitor = platform-global observability
  "error_groups",
  "error_notes",
]);

// Excluded entirely — the migration runner creates + owns `schema_migrations`.
const EXCLUDE = new Set(["schema_migrations"]);

// Natural-key UNIQUE constraints → prepend enterprise_id (each enterprise mints
// its own codes, so a global unique would collide across enterprises).
const COMPOSITE_UNIQUE = {
  billing_charges_period_start_key: "(enterprise_id, period_start)",
  brands_category_name_key: "(enterprise_id, category, name)",
  collections_collection_code_key: "(enterprise_id, collection_code)",
  customers_customer_code_key: "(enterprise_id, customer_code)",
  expenditure_categories_name_key: "(enterprise_id, name)",
  expenditures_expenditure_code_key: "(enterprise_id, expenditure_code)",
  goods_receipts_grn_number_key: "(enterprise_id, grn_number)",
  invoice_series_prefix_fin_year_key: "(enterprise_id, prefix, fin_year)",
  invoices_invoice_number_key: "(enterprise_id, invoice_number)",
  orders_order_code_key: "(enterprise_id, order_code)",
  products_product_name_key: "(enterprise_id, product_name)",
  stock_adjustments_adjustment_number_key: "(enterprise_id, adjustment_number)",
  stock_locations_code_key: "(enterprise_id, code)",
  stock_transfers_transfer_number_key: "(enterprise_id, transfer_number)",
  visits_visit_code_key: "(enterprise_id, visit_code)",
};
// Natural-key PRIMARY KEY → composite (settings key repeats per enterprise).
const COMPOSITE_PK = {
  system_settings_pkey: "PRIMARY KEY (enterprise_id, key)",
};

// New foundation tables (NOT from the dump). Control-plane + onboarding.
const FOUNDATION_TABLES = `
-- ── Foundation: enterprises + control-plane + onboarding ────────────────────
CREATE TABLE public.enterprises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    legal_name text NOT NULL,
    gstin text NOT NULL,
    contact_name text NOT NULL,
    contact_phone text NOT NULL,
    contact_email text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    address_city text NOT NULL,
    address_state text NOT NULL,
    address_pincode text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enterprises_status_check CHECK (status IN ('pending','active','rejected','suspended'))
);

CREATE TABLE public.platform_owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id text NOT NULL,
    name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.enterprise_billing_config (
    enterprise_id uuid NOT NULL,
    model text NOT NULL,
    unit_amount_paisa integer,
    flat_amount_paisa integer,
    gst_rate_bp integer DEFAULT 1800 NOT NULL,
    currency text DEFAULT 'INR' NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ebc_model_check CHECK (model IN ('per_seat','flat'))
);

CREATE TABLE public.subscription_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enterprise_id uuid NOT NULL,
    charge_id uuid NOT NULL,
    invoice_no text NOT NULL,
    invoice_date date NOT NULL,
    taxable_paisa integer NOT NULL,
    gst_paisa integer NOT NULL,
    total_paisa integer NOT NULL,
    their_gstin text,
    hsn_sac text,
    r2_key text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.onboarding_drafts (
    user_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dues_bands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enterprise_id uuid NOT NULL,
    ordinal integer NOT NULL,
    from_days integer NOT NULL,
    to_days integer,
    label text NOT NULL
);
`;

// Foundation constraints (PK/UNIQUE) + FKs. enterprise_id/charge_id/user_id FKs
// are appended by the generator together with the scoped-table FKs.
const FOUNDATION_PK_UNIQUE = `
ALTER TABLE ONLY public.enterprises ADD CONSTRAINT enterprises_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.platform_owners ADD CONSTRAINT platform_owners_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.platform_owners ADD CONSTRAINT platform_owners_auth_user_id_key UNIQUE (auth_user_id);
ALTER TABLE ONLY public.enterprise_billing_config ADD CONSTRAINT enterprise_billing_config_pkey PRIMARY KEY (enterprise_id);
ALTER TABLE ONLY public.subscription_invoices ADD CONSTRAINT subscription_invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subscription_invoices ADD CONSTRAINT subscription_invoices_charge_id_key UNIQUE (charge_id);
ALTER TABLE ONLY public.onboarding_drafts ADD CONSTRAINT onboarding_drafts_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.dues_bands ADD CONSTRAINT dues_bands_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dues_bands ADD CONSTRAINT dues_bands_enterprise_id_ordinal_key UNIQUE (enterprise_id, ordinal);
`;

const FOUNDATION_FK = `
ALTER TABLE ONLY public.enterprises ADD CONSTRAINT enterprises_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.enterprises ADD CONSTRAINT enterprises_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.platform_owners(id);
ALTER TABLE ONLY public.enterprise_billing_config ADD CONSTRAINT enterprise_billing_config_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES public.enterprises(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subscription_invoices ADD CONSTRAINT subscription_invoices_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES public.enterprises(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subscription_invoices ADD CONSTRAINT subscription_invoices_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES public.billing_charges(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.onboarding_drafts ADD CONSTRAINT onboarding_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dues_bands ADD CONSTRAINT dues_bands_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES public.enterprises(id) ON DELETE CASCADE;
`;

// Foundation tables that are enterprise-scoped (get the standard enterprise_id policy):
const FOUNDATION_SCOPED = ["enterprise_billing_config", "subscription_invoices", "dues_bands"];

// ── Parse the dump into statements ──────────────────────────────────────────
const raw = readFileSync(SRC, "utf8");
const lines = raw.split("\n");
const statements = [];
let buf = [];
for (const line of lines) {
  if (line.startsWith("--")) continue; // section comments
  if (buf.length === 0 && line.trim() === "") continue; // inter-statement blanks
  buf.push(line);
  if (line.trimEnd().endsWith(";")) {
    statements.push(buf.join("\n").trim());
    buf = [];
  }
}

const isNeonAuth = (s) => /\bneon_auth\b/.test(s);
const tableOf = (re, s) => {
  const m = s.match(re);
  return m ? m[1] : null;
};

let keepExtension = "";
const createTables = []; // {name, sql}
const pkUnique = [];
const fks = [];
const indexes = [];

for (const stmt of statements) {
  if (/^SET\b/i.test(stmt) || /^SELECT pg_catalog\./i.test(stmt)) continue;
  if (/^CREATE SCHEMA/i.test(stmt)) continue; // neon_auth schema — Neon Auth owns it
  if (/^CREATE EXTENSION/i.test(stmt)) { keepExtension += stmt + "\n"; continue; }
  if (isNeonAuth(stmt)) continue; // drop every neon_auth object

  let t = tableOf(/^CREATE TABLE public\.("?[\w]+"?) \(/, stmt);
  if (t) {
    const name = t.replace(/"/g, "");
    if (!EXCLUDE.has(name)) createTables.push({ name, sql: stmt });
    continue;
  }

  if (/^ALTER TABLE ONLY public\./i.test(stmt) && /ADD CONSTRAINT/i.test(stmt)) {
    const on = tableOf(/^ALTER TABLE ONLY public\.("?[\w]+"?)/, stmt);
    if (on && EXCLUDE.has(on.replace(/"/g, ""))) continue;
    if (/FOREIGN KEY/i.test(stmt)) fks.push(stmt);
    else pkUnique.push(stmt);
    continue;
  }
  if (/^CREATE (UNIQUE )?INDEX/i.test(stmt)) {
    const on = tableOf(/ ON public\.("?[\w]+"?)/, stmt);
    if (on && EXCLUDE.has(on.replace(/"/g, ""))) continue;
    if (!isNeonAuth(stmt)) indexes.push(stmt);
    continue;
  }
  // anything else from a schema-only dump is unexpected — surface it
  console.error("WARN: unclassified statement skipped:\n" + stmt.slice(0, 120));
}

// The full scoped set = every public table except the global ones.
const allPublic = createTables.map((c) => c.name);
const scoped = new Set(allPublic.filter((n) => !GLOBAL.has(n)));

// ── Transform CREATE TABLE: inject enterprise_id into scoped tables ──────────
function injectEnterpriseId(sql, name) {
  if (!scoped.has(name)) return sql;
  // insert as the first column, right after `CREATE TABLE public.<name> (`.
  // DEFAULT reads the per-request GUC, so an INSERT that doesn't mention
  // enterprise_id auto-fills it from app.enterprise_id (set by the scoped client)
  // — no INSERT call-site needs to change, and RLS WITH CHECK then passes.
  // Control-plane inserts (owner, no GUC) must set enterprise_id explicitly.
  return sql.replace(
    /^(CREATE TABLE public\.(?:"?[\w]+"?) \()\n/,
    `$1\n    enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id(),\n`,
  );
}

// ── Transform constraints: composite uniques + system_settings PK ───────────
function transformConstraint(stmt) {
  for (const [cname, cols] of Object.entries(COMPOSITE_UNIQUE)) {
    if (stmt.includes(`ADD CONSTRAINT ${cname} UNIQUE`)) {
      return stmt.replace(/UNIQUE \([^)]*\)/, `UNIQUE ${cols}`);
    }
  }
  for (const [cname, repl] of Object.entries(COMPOSITE_PK)) {
    if (stmt.includes(`ADD CONSTRAINT ${cname} PRIMARY KEY`)) {
      return stmt.replace(/PRIMARY KEY \([^)]*\)/, repl);
    }
  }
  return stmt;
}

// ── Assemble ────────────────────────────────────────────────────────────────
const out = [];
out.push("-- Distribution OS — consolidated multi-enterprise baseline (Phase 2).");
out.push("-- GENERATED by packages/db/tools/generate-init.mjs — do not edit by hand.");
out.push("-- Source: Sri Aparajita live schema (introspected). enterprise_id + RLS baked in.");
out.push("");
out.push("BEGIN;");
out.push("");
out.push(keepExtension.trim());
out.push("");
out.push("-- ── RLS helper functions (empty GUC → NULL, so policies fail closed) ───────");
out.push(`CREATE FUNCTION public.app_current_enterprise_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.enterprise_id', true), '')::uuid $$;`);
out.push(`CREATE FUNCTION public.app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;`);
out.push("");
out.push(FOUNDATION_TABLES.trim());
out.push("");
out.push("-- ── Business tables (from live schema; enterprise_id injected into scoped) ──");
for (const { name, sql } of createTables) out.push(injectEnterpriseId(sql, name) + "\n");

out.push("-- ── Primary keys & unique constraints ──────────────────────────────────────");
out.push(FOUNDATION_PK_UNIQUE.trim());
for (const stmt of pkUnique) out.push(transformConstraint(stmt));
out.push("");

out.push("-- ── Foreign keys ───────────────────────────────────────────────────────────");
out.push(FOUNDATION_FK.trim());
out.push("-- enterprise_id FK for every scoped table:");
for (const name of [...scoped].sort())
  out.push(`ALTER TABLE ONLY public.${name} ADD CONSTRAINT ${name}_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES public.enterprises(id);`);
out.push("-- original business FKs:");
for (const stmt of fks) out.push(stmt);
out.push("");

out.push("-- ── Indexes (from live schema) ─────────────────────────────────────────────");
for (const stmt of indexes) out.push(stmt);
out.push("-- enterprise_id indexes (RLS filter performance):");
for (const name of [...scoped].sort())
  out.push(`CREATE INDEX ${name}_enterprise_id_idx ON public.${name} (enterprise_id);`);
out.push("");

// ── Roles ───────────────────────────────────────────────────────────────────
// Owner (migrations/control-plane/cockpit) = the role running this migration; as
// the table OWNER it bypasses RLS (we do NOT force). The enterprise API connects
// (or SET ROLEs) as app_tenant — a non-owner, so RLS applies. app_readonly is the
// SELECT-only tenant for the Phase-4 MCP. No BYPASSRLS / superuser needed on Neon.
out.push("-- ── Roles (tenant isolation without FORCE/BYPASSRLS) ───────────────────────");
out.push(`DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly NOLOGIN;
  END IF;
  -- let the owner (whoever runs this) SET ROLE into the tenant roles
  EXECUTE format('GRANT app_tenant TO %I', current_user);
  EXECUTE format('GRANT app_readonly TO %I', current_user);
END $$;`);
out.push("GRANT USAGE ON SCHEMA public TO app_tenant, app_readonly;");
out.push("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;");
out.push("GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;");
out.push("-- enterprises + control-plane stay owner-only: revoke tenant write, keep read.");
out.push("REVOKE INSERT, UPDATE, DELETE ON public.enterprises, public.platform_owners,");
out.push("  public.enterprise_billing_config, public.subscription_invoices FROM app_tenant;");
out.push("REVOKE ALL ON public.platform_owners FROM app_tenant, app_readonly;");
out.push("");

// ── RLS ─────────────────────────────────────────────────────────────────────
out.push("-- ── Row-Level Security: every enterprise-scoped table ──────────────────────");
out.push("-- ENABLE (not FORCE): the owner role bypasses RLS (control-plane + cockpit);");
out.push("-- app_tenant obeys it. The app sets `app.enterprise_id` per request via");
out.push("-- SET LOCAL inside the txn. current_setting(..., true) is NULL when unset →");
out.push("-- policy fails closed (no rows).");
const enterpriseScoped = [...scoped, ...FOUNDATION_SCOPED].sort();
for (const name of enterpriseScoped) {
  out.push(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;`);
  out.push(`CREATE POLICY enterprise_isolation ON public.${name}`);
  out.push(`  USING (enterprise_id = public.app_current_enterprise_id())`);
  out.push(`  WITH CHECK (enterprise_id = public.app_current_enterprise_id());`);
}
out.push("");
out.push("-- enterprises: a tenant session reads only its own row (owner manages writes).");
out.push("ALTER TABLE public.enterprises ENABLE ROW LEVEL SECURITY;");
out.push("CREATE POLICY enterprise_self ON public.enterprises FOR SELECT");
out.push("  USING (id = public.app_current_enterprise_id());");
out.push("");
out.push("-- onboarding_drafts: pre-enterprise; scoped to the signed-up user.");
out.push("ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;");
out.push("CREATE POLICY onboarding_self ON public.onboarding_drafts");
out.push("  USING (user_id = public.app_current_user_id())");
out.push("  WITH CHECK (user_id = public.app_current_user_id());");
out.push("");
out.push("-- platform_owners: owner-only. RLS on, NO policy → tenants see nothing;");
out.push("-- the owner role (non-forced) manages it.");
out.push("ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;");
out.push("");
out.push("COMMIT;");
out.push("");

writeFileSync(OUT, out.join("\n"));
console.log(`Wrote ${OUT}`);
console.log(`  public tables: ${createTables.length} (scoped ${scoped.size}, global ${GLOBAL.size})`);
console.log(`  foundation tables: 6`);
console.log(`  PK/UNIQUE: ${pkUnique.length + 9} | FKs: ${fks.length} + ${scoped.size} enterprise_id + 7 foundation | indexes: ${indexes.length} + ${scoped.size} enterprise_id`);
console.log(`  RLS policies: ${enterpriseScoped.length} enterprise + enterprises + onboarding_drafts (platform_owners deny-all)`);
