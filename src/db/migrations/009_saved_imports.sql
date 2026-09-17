-- Dan's Instagram saved collections → Content Library. The Google Sheet (library/collections.yaml → sheet) is the input;
-- this table is the durable queue + audit trail so an import survives restarts and is never re-run on the same link.

ALTER TABLE bot.library_items ADD COLUMN IF NOT EXISTS collection TEXT;   -- the saved-collection name the video came from
ALTER TABLE bot.library_items ADD COLUMN IF NOT EXISTS for_person TEXT;   -- "leah" when the collection was saved for one girl
CREATE INDEX IF NOT EXISTS library_items_collection_idx ON bot.library_items (collection);
CREATE INDEX IF NOT EXISTS library_items_person_idx ON bot.library_items (for_person);

CREATE TABLE IF NOT EXISTS bot.saved_imports (
  url         TEXT PRIMARY KEY,                    -- canonical source url
  collection  TEXT NOT NULL,
  author      TEXT,
  kind        TEXT,                                -- reel | p (post/photo) as seen in the saved grid
  position    INT,                                 -- order inside the collection (0 = most recently saved)
  status      TEXT NOT NULL DEFAULT 'queued',      -- queued | filed | dupe | skipped | failed
  item_id     BIGINT,
  genre       TEXT,
  note        TEXT,
  imported_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_imports_status_idx ON bot.saved_imports (status, collection, position);
