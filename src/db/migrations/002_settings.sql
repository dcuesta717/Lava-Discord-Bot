-- Key/value settings the bot manages itself (staff channel ids, owner list, guild owner). Replaces most manual .env ids.
CREATE TABLE IF NOT EXISTS bot.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
