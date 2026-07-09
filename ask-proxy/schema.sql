-- =============================================================================
-- FLCC Kasama — Anonymous Prayer Chain (Cloudflare D1 / SQLite)
-- =============================================================================
--
-- SETUP (one time):
--   1. wrangler d1 create flcc-kasama
--   2. Copy the database_id into wrangler.toml ([[d1_databases]] block)
--   3. wrangler d1 execute flcc-kasama --remote --file=ask-proxy/schema.sql
--
-- (The Worker also runs these statements lazily with IF NOT EXISTS, so simply
-- binding the database is enough — this file documents the canonical shape.)
--
-- Privacy by design: prayers are anonymous. The only per-user data ever stored
-- is user_hash — a SHA-256 of a random device id + prayer id, computed on the
-- device. It cannot be linked back to any person, and exists purely so one
-- device can't inflate a prayer count by tapping twice.
-- =============================================================================

CREATE TABLE IF NOT EXISTS prayers (
  id           TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  mood_tag     TEXT,
  country_code TEXT,               -- 'KWT', 'HKG', … regional solidarity, never identity
  prayer_count INTEGER DEFAULT 0,  -- how many kapatid have prayed for this
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prayer_interactions (
  id        TEXT PRIMARY KEY,
  prayer_id TEXT NOT NULL,
  user_hash TEXT NOT NULL          -- un-linkable SHA-256, see note above
);

-- One prayer per device per request — duplicate taps are lovingly ignored.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prayer_interactions_unique
  ON prayer_interactions (prayer_id, user_hash);

CREATE INDEX IF NOT EXISTS idx_prayers_created_at
  ON prayers (created_at DESC);

-- Web Push subscriptions for the "new prayer" notification. One row per
-- device that opted in; endpoint is the browser push service URL (unique
-- per device/installation), p256dh/auth are the device's own public key and
-- auth secret used to encrypt messages to it (RFC 8291) — never usable to
-- identify a person, only to deliver an encrypted notification.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
