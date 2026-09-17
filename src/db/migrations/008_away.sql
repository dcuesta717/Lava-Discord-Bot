-- Away-reply log: every time the bot answered (or escalated) for an owner. Owners review these to fix knowledge/faq.md.
CREATE TABLE IF NOT EXISTS bot.away_replies (
  id         BIGSERIAL PRIMARY KEY,
  model_slug TEXT NOT NULL,
  where_     TEXT NOT NULL,                  -- channel | dm
  channel_id TEXT,
  message_id TEXT,
  question   TEXT,
  reply      TEXT,
  answered   BOOLEAN NOT NULL DEFAULT false,
  escalated  BOOLEAN NOT NULL DEFAULT false,
  topic      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
