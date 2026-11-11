-- 0004_stock_and_invoicing.sql
--
-- Phase 1: Stock Management (multi-godown append-only ledger) + in-system GST
-- invoice generation. Additive and idempotent (re-runnable). See
-- docs/INVOICING-STOCK-ARCHITECTURE.md for the design and the locked decisions:
--   * SKUs are the EXISTING catalogue — products(id) x product_packs.pack_size_litres.
--     This migration adds NO new product/SKU master; stock points at that catalogue.
--   * Balance = sum of the append-only stock_movements ledger; stock_balances is a
--     rebuildable cache kept in step with every ledger write.
--   * Invoicing: 18% GST (CGST 9 + SGST 9 intra-Telangana, IGST 18 inter-state),
--     one gap-free series per financial year, hard-block on short stock.
--   * A few godowns under ONE GSTIN (company GSTIN lives in system_settings).
--
-- The existing public.invoices table (upload/parse oriented, line_items jsonb) is
-- EXTENDED, not replaced; generated invoices additionally carry structured
-- public.invoice_items rows.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Stock locations (godowns) — all under the single company GSTIN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE,
    address_line text,
    city text,
    state text DEFAULT 'Telangana' NOT NULL,
    state_code text DEFAULT '36' NOT NULL,
    pincode text,
    is_default boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT stock_locations_status_check CHECK (status IN ('active', 'inactive'))
);
-- At most one default location.
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_one_default_idx
    ON public.stock_locations (is_default) WHERE is_default;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Stock movement ledger — append-only source of truth
--    One signed row per movement. kind drives the sign convention:
--      opening / grn / transfer_in / sale_reversal  -> qty_units > 0
--      sale / transfer_out                           -> qty_units < 0
--      adjustment                                     -> either sign
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,          -- signed
    litres numeric(14,2),                       -- signed, derived (qty * pack)
    kind text NOT NULL,
    ref_type text,                              -- grn | invoice | transfer | adjustment | opening
    ref_id uuid,
    note text,
    moved_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_kind_check CHECK (
        kind IN ('opening', 'grn', 'sale', 'sale_reversal', 'transfer_in', 'transfer_out', 'adjustment')
    )
);
CREATE INDEX IF NOT EXISTS stock_movements_sku_idx
    ON public.stock_movements (location_id, product_id, pack_size_litres);
CREATE INDEX IF NOT EXISTS stock_movements_ref_idx
    ON public.stock_movements (ref_type, ref_id);
CREATE INDEX IF NOT EXISTS stock_movements_moved_at_idx
    ON public.stock_movements (moved_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Stock balances — maintained cache, rebuildable from stock_movements
--    PK is the SKU-at-location: (location, product, pack size).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_balances (
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    qty_units numeric(14,2) DEFAULT 0 NOT NULL,
    reorder_level numeric(14,2),                -- optional low-stock threshold
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (location_id, product_id, pack_size_litres),
    -- Hard-block backstop: any write that would drive a balance below zero
    -- (an over-sold invoice racing another, an over-transfer) aborts its whole
    -- batch at the DB, so the ledger can never go negative. The app also
    -- pre-checks and returns a friendly 409 before attempting the write.
    CONSTRAINT stock_balances_nonneg CHECK (qty_units >= 0)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Goods receipts (GRN) — supplier deliveries -> stock IN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goods_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number text NOT NULL UNIQUE,
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    supplier_name text NOT NULL,
    supplier_invoice_no text,
    supplier_invoice_date date,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    reference text,
    total_value numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'posted' NOT NULL,
    note text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT goods_receipts_status_check CHECK (status IN ('posted', 'cancelled'))
);
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    rate numeric(14,4),
    amount numeric(14,2)
);
CREATE INDEX IF NOT EXISTS goods_receipt_items_grn_idx
    ON public.goods_receipt_items (grn_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Inter-godown transfers — posted as paired movements (-source / +dest)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number text NOT NULL UNIQUE,
    from_location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    to_location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    status text DEFAULT 'posted' NOT NULL,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT stock_transfers_status_check CHECK (status IN ('posted', 'cancelled')),
    CONSTRAINT stock_transfers_distinct_loc CHECK (from_location_id <> to_location_id)
);
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS stock_transfer_items_transfer_idx
    ON public.stock_transfer_items (transfer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Stock adjustments — damage / count correction / write-off / expiry
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number text NOT NULL UNIQUE,
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    reason text NOT NULL,
    note text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT stock_adjustments_reason_check CHECK (
        reason IN ('damage', 'count_correction', 'write_off', 'expiry', 'other')
    )
);
CREATE TABLE IF NOT EXISTS public.stock_adjustment_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id uuid NOT NULL REFERENCES public.stock_adjustments(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    delta_units numeric(14,2) NOT NULL          -- signed +/-
);
CREATE INDEX IF NOT EXISTS stock_adjustment_items_adj_idx
    ON public.stock_adjustment_items (adjustment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Invoice numbering series — gap-free, one per financial year
--    The app allocates atomically:
--      UPDATE invoice_series SET next_seq = next_seq + 1 WHERE id = $1 RETURNING next_seq
--    and formats prefix + fin_year + lpad(next_seq-1, pad_width).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_series (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix text DEFAULT 'SA/' NOT NULL,
    fin_year text NOT NULL,                     -- e.g. '2026-27'
    next_seq integer DEFAULT 1 NOT NULL,
    pad_width integer DEFAULT 5 NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (prefix, fin_year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Structured line items for GENERATED invoices (uploaded ones keep line_items jsonb)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id),
    description text,                           -- snapshot of product name
    pack_size_litres numeric(12,4),
    brand text,
    segment text,
    hsn_code text DEFAULT '27101980' NOT NULL,
    qty_units numeric(14,2) NOT NULL,
    rate numeric(14,4) NOT NULL,                -- entered at invoice time
    taxable_amount numeric(14,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 18 NOT NULL,
    cgst numeric(14,2) DEFAULT 0 NOT NULL,
    sgst numeric(14,2) DEFAULT 0 NOT NULL,
    igst numeric(14,2) DEFAULT 0 NOT NULL,
    line_total numeric(14,2) NOT NULL,
    order_item_id uuid REFERENCES public.order_items(id),
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx
    ON public.invoice_items (invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Extend public.invoices for in-system generation
--    (all additive; existing uploaded/historical invoices are unaffected and
--     default to doc_status 'final'.)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.stock_locations(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.invoice_series(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS supply_type text;           -- 'intra' | 'inter'
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer_state_code text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cgst_amount numeric(14,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sgst_amount numeric(14,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS igst_amount numeric(14,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS round_off numeric(14,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS doc_status text DEFAULT 'final' NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancel_reason text;

DO $$ BEGIN
    ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_doc_status_check CHECK (doc_status IN ('draft', 'final', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_supply_type_check CHECK (supply_type IS NULL OR supply_type IN ('intra', 'inter'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
