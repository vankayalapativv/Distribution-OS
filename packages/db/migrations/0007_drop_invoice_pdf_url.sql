-- 0007_drop_invoice_pdf_url.sql
--
-- Invoice PDFs are now rendered ON DEMAND from the invoice data (the shared
-- renderer runs in the browser AND on Cloudflare Workers), so no copy is stored
-- in R2. The invoice_pdf_url column (added in 0004) is no longer read or written
-- by any code — drop it.
--
-- ⚠️ DEPLOY ORDER: apply this ONLY after the on-demand-rendering API is deployed.
-- The prior API read invoice_pdf_url in getInvoiceFile; dropping the column while
-- that older code is still live would break invoice PDF downloads (the mobile SE
-- WhatsApp-share flow). Ship code first, then run this migration.
--
-- (The orphaned R2 blobs the column used to point at are not removed here; they
-- can be swept from the bucket separately — they are already unreferenced.)

ALTER TABLE public.invoices DROP COLUMN IF EXISTS invoice_pdf_url;
