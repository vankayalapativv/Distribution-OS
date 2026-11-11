-- 0021_stock_reorder_alerts.sql
-- Low-stock reorder alerting: per-(godown, product, pack) de-dup state so we raise
-- ONE 'low_stock' alert per downward crossing (qty <= reorder_level) and auto-close
-- it on restock. A non-null open_alert_id means an OPEN low-stock alert already
-- exists for this SKU at this godown → stay silent until it is restocked above
-- reorder and crosses again.
CREATE TABLE IF NOT EXISTS public.stock_reorder_state (
    location_id uuid NOT NULL,
    product_id uuid NOT NULL,
    pack_size_litres numeric(12,4) NOT NULL,
    open_alert_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (location_id, product_id, pack_size_litres)
);
