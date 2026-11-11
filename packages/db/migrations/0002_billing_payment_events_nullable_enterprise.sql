-- Billing webhook idempotency ledger: allow a NULL enterprise_id.
--
-- billing_payment_events is written by the Razorpay webhook, which is
-- unauthenticated and therefore runs on the OWNER client with NO enterprise GUC
-- set. Phase 2 blanket-added `enterprise_id uuid NOT NULL DEFAULT
-- public.app_current_enterprise_id()` to every table, but here that default
-- evaluates to NULL (no GUC) and the NOT NULL then rejects the insert — so the
-- webhook could not record the event and the paid-flip would fail.
--
-- The ledger is keyed by the globally-unique Razorpay event_id (its PK); the
-- enterprise is incidental. Make the column nullable so the owner-client insert
-- succeeds. The default is left in place: a scoped caller still auto-fills it.

ALTER TABLE public.billing_payment_events
  ALTER COLUMN enterprise_id DROP NOT NULL;
