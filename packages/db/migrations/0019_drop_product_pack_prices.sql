-- Pricing (MRP / MOP / DLP) is no longer a property of the catalogue — the client
-- enters those per scenario in the Margin simulator (margin_simulations keeps its
-- own mrp/dlp/mop). Drop the catalogue price columns from product_packs. Destructive:
-- existing per-pack price values are discarded (intentional). invoice_items.mrp
-- (a per-line snapshot the client types at invoicing) is unaffected.
ALTER TABLE public.product_packs DROP COLUMN IF EXISTS mrp;
ALTER TABLE public.product_packs DROP COLUMN IF EXISTS mop;
ALTER TABLE public.product_packs DROP COLUMN IF EXISTS dlp;
