-- Content plans ("Content House — December"): a hand-picked shoot list the owners keep as a Google Sheet with one tab per
-- section (shared formats + one tab per girl). library/plans/<slug>.yaml is the input; these tables are the durable queue,
-- the cross-section membership (the same reel is often on several tabs) and the Discord render state.

CREATE TABLE IF NOT EXISTS bot.plan_items (
  plan        TEXT NOT NULL,                     -- plan slug (library/plans/<slug>.yaml)
  section     TEXT NOT NULL,                     -- section name as in the yaml (= sheet tab = forum thread)
  url         TEXT NOT NULL,                     -- canonical source url
  position    INT,                               -- order inside the section
  note        TEXT,                              -- the owners' note next to the link in the sheet
  status      TEXT NOT NULL DEFAULT 'queued',    -- queued | filed | failed
  item_id     BIGINT,                            -- bot.library_items.id once filed (shared across sections)
  genre       TEXT,
  detail      TEXT,                              -- failure reason / "already in the library"
  imported_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, section, url)
);
CREATE INDEX IF NOT EXISTS plan_items_status_idx ON bot.plan_items (plan, status);
CREATE INDEX IF NOT EXISTS plan_items_item_idx ON bot.plan_items (item_id);

-- one forum thread per section; re-rendering edits in place instead of posting twice
CREATE TABLE IF NOT EXISTS bot.plan_threads (
  plan        TEXT NOT NULL,
  section     TEXT NOT NULL,
  thread_id   TEXT NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, section)
);
