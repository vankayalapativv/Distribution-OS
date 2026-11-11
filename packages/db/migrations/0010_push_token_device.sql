-- 0010 — record the device on push-token registration.
--
-- The mobile app registers its Expo push token on EVERY login (all roles), so
-- it's the one hook that sees every device — unlike tracking heartbeats, which
-- only field staff generate. Storing the manufacturer/model here lets the Users
-- → Manage sessions screen label a mobile session with the real device, even
-- for an office account that just signs in to check.
--
-- Safe: additive, nullable columns; nothing reads them until the app starts
-- sending them.

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS model text;
