-- Transportation charge billed to the customer on a generated invoice
-- (goods sent via Porter / Rapido / etc.). It is added DIRECTLY to the grand
-- total (invoice_net_value) with NO GST on it. Defaults to 0, so every existing
-- invoice is unchanged. This is distinct from the existing `transport` text
-- column, which holds the transporter name printed in the party box.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS transport_charge numeric(14,2) NOT NULL DEFAULT 0;
