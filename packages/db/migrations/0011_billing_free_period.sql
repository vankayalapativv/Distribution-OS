-- Configurable free / trial period per enterprise (Owner cockpit billing).
--
-- Until now the only "free" signal was a billing_charges row pre-seeded with
-- status='free' (the approval month). The owner now needs richer control over
-- when billing actually starts for a tenant:
--
--   * free until end of the current month  -> free_until = IST end-of-month
--   * free for a fixed N months            -> free_until = start of (month + N)
--   * open-ended (free until I turn it on) -> free_forever = true
--   * bill immediately (no free period)    -> free_until null, free_forever false
--
-- A calendar month is FREE iff `free_forever` OR (`free_until` is set AND the
-- month's period_start < free_until). Otherwise it is billed (pending). The
-- charge-generation code (ensureCurrentCharge / syncPendingCharge) reads these to
-- decide a new/open month's status; a PAID month is never changed.
--
-- Both columns are additive and nullable/defaulted, so existing rows keep today's
-- behaviour (free_forever=false, free_until=null => bill from the next generated
-- month, exactly as before). IF NOT EXISTS so re-running is safe.

alter table enterprise_billing_config
  add column if not exists free_until timestamptz,
  add column if not exists free_forever boolean not null default false;
