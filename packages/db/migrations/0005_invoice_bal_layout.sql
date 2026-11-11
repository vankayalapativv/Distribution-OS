-- 0005 — fields the BAL-style generated invoice prints that we didn't store yet.
--
-- Per-line: MRP (a printed reference price — does NOT affect the math) and an
-- optional discount %. Taxable stays rate * qty * (1 - discount_pct/100).
-- Invoice header: logistics fields the BAL sheet shows (transport / vehicle /
-- GR-RR). `station` and `party_phone` already exist (added for uploaded invoices).
--
-- All additive + IF NOT EXISTS, so it is safe to run once on an existing DB.
-- Company Tel/email, Terms & Conditions and the invoice-number prefix are stored
-- in system_settings (key/value) and need no schema change.

alter table invoice_items add column if not exists mrp numeric(12, 2);
alter table invoice_items add column if not exists discount_pct numeric(5, 2) not null default 0;

alter table invoices add column if not exists transport text;
alter table invoices add column if not exists vehicle_no text;
alter table invoices add column if not exists gr_rr_no text;
