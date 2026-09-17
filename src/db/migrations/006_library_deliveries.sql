-- Which Content Library items were pushed to which model's channel ("today's picks"), so nobody gets the same video twice.
CREATE TABLE IF NOT EXISTS bot.library_deliveries (
  item_id      BIGINT NOT NULL REFERENCES bot.library_items (id) ON DELETE CASCADE,
  model_slug   TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, model_slug)
);
