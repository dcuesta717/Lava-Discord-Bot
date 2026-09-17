-- Daily account analytics (7 AM reports). One Apify "details" result per model per day fills both tables.

CREATE TABLE IF NOT EXISTS bot.account_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  model_slug  TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'instagram',
  day         DATE NOT NULL,                    -- model-local date the snapshot represents
  taken_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  followers   INT,
  follows     INT,
  posts_count INT,
  UNIQUE (model_slug, platform, day)
);

-- Her own posts as we see them each morning; metrics history lets us show growth per post.
CREATE TABLE IF NOT EXISTS bot.model_posts (
  id          BIGSERIAL PRIMARY KEY,
  model_slug  TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'instagram',
  source_url  TEXT NOT NULL,
  shortcode   TEXT,
  kind        TEXT,                             -- reel | photo | carousel
  caption     TEXT,
  posted_at   TIMESTAMPTZ,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  audio       TEXT,
  hashtags    TEXT[] NOT NULL DEFAULT '{}',
  genre       TEXT,                             -- Content Library lane (library/genres.yaml) — Claude
  format      TEXT,                             -- ≤ 6-word format label — Claude
  likes       INT,
  comments    INT,
  views       INT,
  metrics     JSONB NOT NULL DEFAULT '[]',      -- [{at, likes, comments, views}] one per morning
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_slug, source_url)
);
CREATE INDEX IF NOT EXISTS model_posts_slug_posted_idx ON bot.model_posts (model_slug, posted_at DESC);
