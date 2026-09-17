-- Postgres (Supabase). Every bot action that changes state lands here (CLAUDE.md rule 3). Notion is a mirror, this is the truth.
-- Tables live in a dedicated schema so the Supabase dashboard stays tidy and RLS is irrelevant (the bot uses the service connection).

CREATE SCHEMA IF NOT EXISTS bot;

CREATE TABLE IF NOT EXISTS bot.timers (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,            -- 'live:checkin' | 'live:timeout' | 'insights:reminder' | 'post:publish' …
  model_slug    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  fire_at       TIMESTAMPTZ NOT NULL,
  fired_at      TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS timers_due ON bot.timers (fire_at) WHERE fired_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS bot.live_sessions (
  id               BIGSERIAL PRIMARY KEY,
  model_slug       TEXT NOT NULL,
  platform         TEXT NOT NULL DEFAULT 'tiktok',
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  ended_by         TEXT,                  -- 'command' | 'button' | 'timeout'
  checkins         INT NOT NULL DEFAULT 0,
  alert_message_id TEXT
);
CREATE INDEX IF NOT EXISTS live_sessions_open ON bot.live_sessions (model_slug) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS bot.weekly_metrics (
  id                BIGSERIAL PRIMARY KEY,
  model_slug        TEXT NOT NULL,
  week_start        DATE NOT NULL,
  week_end          DATE NOT NULL,
  views             BIGINT,
  net_followers     INT,
  interactions      BIGINT,
  pct_followers     REAL,
  pct_non_followers REAL,
  reels_views       BIGINT,
  posts_views       BIGINT,
  stories_views     BIGINT,
  live_views        BIGINT,
  screenshot_url    TEXT,
  raw_json          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_slug, week_start)
);

CREATE TABLE IF NOT EXISTS bot.content_requests (
  id                 BIGSERIAL PRIMARY KEY,
  model_slug         TEXT NOT NULL,
  requested_by       TEXT NOT NULL,       -- discord user id
  raw_request        TEXT NOT NULL,
  brief              TEXT NOT NULL,       -- the rewritten message that was posted
  drive_url          TEXT,
  deadline           TEXT,
  status             TEXT NOT NULL DEFAULT 'requested',  -- requested | uploaded | edited | posted | cancelled
  discord_message_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot.reels (
  id                 BIGSERIAL PRIMARY KEY,
  model_slug         TEXT NOT NULL,
  source_url         TEXT NOT NULL,
  source_platform    TEXT,
  category           TEXT NOT NULL DEFAULT 'Filler',
  brief              TEXT,                -- 1-line "recreate this" instruction
  hook               TEXT,
  views              BIGINT,
  score              REAL,
  status             TEXT NOT NULL DEFAULT 'new',  -- new | on_drive | posted | skipped
  discord_thread_id  TEXT,
  discord_message_id TEXT,
  acted_by           TEXT,
  acted_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_slug, source_url)
);

CREATE TABLE IF NOT EXISTS bot.captions (
  id                 BIGSERIAL PRIMARY KEY,
  model_slug         TEXT NOT NULL,
  brief              TEXT NOT NULL,
  platform           TEXT NOT NULL DEFAULT 'instagram',
  candidates         JSONB NOT NULL,      -- array of strings
  chosen             TEXT,
  critic_json        JSONB,
  status             TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | edited | rejected
  final_text         TEXT,
  approved_by        TEXT,
  discord_message_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot.posts (
  id                 BIGSERIAL PRIMARY KEY,
  model_slug         TEXT NOT NULL,
  caption_id         BIGINT REFERENCES bot.captions(id),
  media_url          TEXT NOT NULL,
  media_type         TEXT NOT NULL DEFAULT 'video',
  platforms          JSONB NOT NULL,      -- array of {platform, accountId}
  scheduled_for      TEXT,                -- local wall-clock "YYYY-MM-DD HH:mm" in `timezone`
  timezone           TEXT,
  zernio_post_id     TEXT,
  status             TEXT NOT NULL DEFAULT 'draft',  -- draft | approved | scheduled | published | failed | rejected
  post_url           TEXT,
  error              TEXT,
  approved_by        TEXT,
  discord_message_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot.earnings (
  id                BIGSERIAL PRIMARY KEY,
  model_slug        TEXT NOT NULL,
  month             TEXT NOT NULL,        -- YYYY-MM
  month_to_date_usd NUMERIC(12,2) NOT NULL,
  source            TEXT NOT NULL DEFAULT 'manual',
  recorded_by       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot.event_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  module      TEXT NOT NULL,
  model_slug  TEXT,
  actor       TEXT,
  event       TEXT NOT NULL,
  data        JSONB
);
CREATE INDEX IF NOT EXISTS event_log_at ON bot.event_log (at DESC);
