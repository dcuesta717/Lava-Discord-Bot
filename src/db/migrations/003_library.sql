-- Content Library: agency-wide inspiration folders (one Discord forum per genre).

-- One row per source video. A video can be posted into more than one genre forum (posts[]), but is stored once.
CREATE TABLE IF NOT EXISTS bot.library_items (
  id             BIGSERIAL PRIMARY KEY,
  source_url     TEXT NOT NULL UNIQUE,          -- normalized (no query string / trailing slash)
  platform       TEXT NOT NULL,                 -- instagram | tiktok
  author         TEXT,
  caption        TEXT,
  genre          TEXT NOT NULL,                 -- primary genre slug (library/genres.yaml)
  tags           TEXT[] NOT NULL DEFAULT '{}',  -- secondary genre slugs
  title          TEXT,                          -- forum post title (the hook)
  why            TEXT,                          -- why it works (≤ 20 words)
  copy_brief     TEXT,                          -- how a girl replicates it (≤ 30 words)
  stats          JSONB NOT NULL DEFAULT '{}',   -- views, likes, comments, posted_at, duration
  score          REAL,                          -- Claude's "worth copying" 0-1
  origin         TEXT NOT NULL,                 -- inbox | scout | command
  added_by       TEXT,                          -- Discord user id for inbox/command
  posts          JSONB NOT NULL DEFAULT '[]',   -- [{genre, forum_id, thread_id}]
  video_attached BOOLEAN NOT NULL DEFAULT false,
  up             INT NOT NULL DEFAULT 0,
  down           INT NOT NULL DEFAULT 0,
  copies         INT NOT NULL DEFAULT 0,        -- "Copy this" taps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_items_genre_idx ON bot.library_items (genre, created_at DESC);

-- Where the daily scout looks. Accounts are added from Discord (/library source add); hashtags default from genres.yaml.
CREATE TABLE IF NOT EXISTS bot.library_sources (
  id         BIGSERIAL PRIMARY KEY,
  genre      TEXT NOT NULL,
  kind       TEXT NOT NULL,                     -- account | hashtag
  value      TEXT NOT NULL,                     -- handle without @ / tag without #
  weight     REAL NOT NULL DEFAULT 1,           -- nudged by 🔥/👎 on posts from this source; < 0.3 = skipped
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (genre, kind, value)
);

CREATE TABLE IF NOT EXISTS bot.library_votes (
  item_id  BIGINT NOT NULL REFERENCES bot.library_items (id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL,
  vote     SMALLINT NOT NULL,                   -- 1 | -1
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
