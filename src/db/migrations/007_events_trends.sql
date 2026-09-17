-- Events (holidays / cultural moments) → per-model ideas, and the 24h trend radar.

-- One-off events added from Discord (/event add); recurring ones live in knowledge/events.yaml.
CREATE TABLE IF NOT EXISTS bot.events (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  on_date    DATE NOT NULL,
  lead_days  INT NOT NULL DEFAULT 7,
  ideas      INT NOT NULL DEFAULT 5,
  lanes      TEXT[] NOT NULL DEFAULT '{}',
  angle      TEXT NOT NULL DEFAULT '',
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which event occurrence each model already got ideas for (event_key = "<name>@<YYYY-MM-DD>").
CREATE TABLE IF NOT EXISTS bot.event_ideas (
  event_key  TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  ideas      JSONB NOT NULL DEFAULT '[]',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, model_slug)
);

-- Signals the scout sees every day (audio / hashtag counts across ALL candidates, not just the ones posted) for spike detection.
CREATE TABLE IF NOT EXISTS bot.trend_signals (
  day        DATE NOT NULL,
  kind       TEXT NOT NULL,                     -- audio | hashtag
  value      TEXT NOT NULL,
  count      INT NOT NULL DEFAULT 0,
  sample_url TEXT,
  genres     TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (day, kind, value)
);

-- Trends we already alerted on (so a 3-day trend alerts once).
CREATE TABLE IF NOT EXISTS bot.trend_alerts (
  kind       TEXT NOT NULL,
  value      TEXT NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, value)
);
