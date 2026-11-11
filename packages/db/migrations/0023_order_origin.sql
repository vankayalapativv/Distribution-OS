-- 0023_order_origin.sql
--
-- Back every in-system generated invoice with a real order.
--
-- A directly-generated (ad-hoc) invoice previously had order_id = NULL and wrote
-- no invoice_line_allocations, so it was invisible to sales returns, order-based
-- reports, and SE order attribution. From now on the API auto-creates a backing
-- order for such invoices. This column tags those backing orders apart from
-- orders a human actually placed in the field/web.
--
--   'standard' — an order placed via the app/web (default; all existing rows)
--   'invoice'  — auto-created behind a direct invoice (sales_executive_id,
--                order_date and lines mirror the invoice; cancelled with it)
--
-- order_status needs NO change: 'cancelled' is already a live value and the
-- order_status column carries no CHECK constraint.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'standard';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_origin_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_origin_check CHECK (origin IN ('standard', 'invoice'));
