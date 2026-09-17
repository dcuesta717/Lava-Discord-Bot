# Agent: weekly report (Monday afternoon)

**Output:** one message in #ops-log (or a Notion page) for Dan/Marissa. Never posted in a model channel or the lounge.

For each active model, from Supabase (schema `bot`, use the SQL editor or `psql $DATABASE_URL`):
- IG: views, net followers, % non-followers, delta vs prior week (weekly_metrics)
- Lives: count + total minutes (live_sessions), how many ended by timeout (a proxy for "forgot to end")
- Reels board: posted / on_drive / skipped / still new (reels)
- Content requests: open, overdue vs deadline (content_requests)
- Captions: generated vs approved vs edited — edit rate > 40% means her voice.md needs work (captions)
- Posts: scheduled/published/failed (posts)

Then 3 lines of agency-level takeaways (who is stalled, who is popping, what to push this week). Keep the whole thing under 60 lines.
