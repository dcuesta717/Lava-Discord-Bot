-- /model add: onboarding runs (Discord structure → Apify research → Claude profile → GitHub commit → live after redeploy)
CREATE TABLE IF NOT EXISTS bot.model_onboarding (
  slug          TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  user_id       TEXT NOT NULL,                 -- her Discord user id
  instagram     TEXT,
  tiktok        TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  status        TEXT NOT NULL DEFAULT 'started', -- started | structured | researched | committed | live | failed
  discord       JSONB NOT NULL DEFAULT '{}',   -- ids from ensureModelStructure
  research      JSONB NOT NULL DEFAULT '{}',   -- Claude's research JSON + computed stats
  commit_sha    TEXT,
  error         TEXT,
  requested_by  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
