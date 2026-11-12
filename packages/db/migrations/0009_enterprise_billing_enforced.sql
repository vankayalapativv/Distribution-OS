-- Per-enterprise billing enforcement.
--
-- The global BILLING_ENFORCED env flag stays a MASTER kill-switch (and the gate's
-- fast short-circuit). This per-enterprise flag opts an individual enterprise into
-- the 402 gate + hard block screen. Default FALSE so demos and newly onboarded
-- enterprises are never blocked until the platform owner enables enforcement for a
-- real paying customer.
alter table enterprise_billing_config
  add column if not exists billing_enforced boolean not null default false;
