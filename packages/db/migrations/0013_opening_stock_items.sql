-- Opening-stock detail lines with batch / expiry / shelf-location, so go-live
-- stock can feed the near-expiry (FEFO) report exactly like a goods-receipt line.
-- Opening still posts its own 'opening' movement + balance (unchanged); this
-- table is the per-line detail record that listNearExpiry UNIONs with
-- goods_receipt_items. Column types mirror goods_receipt_items so the UNION is
-- type-clean.
CREATE TABLE IF NOT EXISTS public.opening_stock_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    pack_size_litres numeric(12,4) NOT NULL,
    brand text,
    qty_units numeric(14,2) NOT NULL,
    batch_number text,
    expiry_date date,
    rack_no text,
    shelf_no text,
    bin_no text,
    opening_date date NOT NULL,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS opening_stock_items_expiry_date
    ON public.opening_stock_items (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS opening_stock_items_location
    ON public.opening_stock_items (location_id);
