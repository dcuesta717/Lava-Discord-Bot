# Daily reports (7 AM)

Dan: "scrape the creators' accounts every morning and send their current analytics to each model; owners get a report of who didn't post the day before, engagement, and the kind of content posted, broken down by model."

## What runs

| When | What | Where |
|---|---|---|
| 06:15 `DEFAULT_TIMEZONE` | **Snapshot.** One Apify `details` call per model (≈ 1 billed result ≈ $0.003) → followers/following/post count into `bot.account_snapshots`; her latest ~12 posts into `bot.model_posts` with a metrics history point per morning. New posts get a lane + format label from Claude (`prompts/post.classify.md`). | — |
| 07:00 her timezone | **Her report** — followers (± day / week), what she posted yesterday with numbers, 7-day averages, comments-per-100-likes, best post of the week. Or "nothing posted yesterday — N days since your last post 👀". Never compares her to other girls. | her `#🔔-notification` |
| 07:00 `DEFAULT_TIMEZONE` | **Owners' digest** — didn't post yesterday (with streak), posted yesterday (what), engagement leaderboard (7-day avg per post + comment ratio), follower movers, content mix per model (reels/photos/carousels × lanes, best format). | `#daily-report` (STAFF) |

`/report` (owners) posts the digest now; `/report model:jane` her report; add `refresh:true` to re-scrape first.

## Definitions

- **Posted yesterday** = a non-pinned post with `posted_at` inside yesterday in *her* timezone. Pinned posts are ignored (they are old).
- **Streak** = days since her last non-pinned post, counted back from yesterday.
- **Engagement leaderboard** ranks by `avg likes + 5 × avg comments` over the last 7 days — comments are the male-attention signal the agency optimises for.
- **Comment ratio** = comments per 100 likes on the 7-day average.
- **Content mix** = counts by `kind` (reel / photo / carousel) and by lane (`genre`, from Claude).

## Data

- `bot.account_snapshots (model_slug, platform, day, followers, follows, posts_count)` — one row per model per day.
- `bot.model_posts` — one row per post the bot has seen; `metrics` is `[{at, likes, comments, views}]` appended every morning, so per-post growth curves are available later.

## Not (yet) done

- TikTok numbers (add a `tiktokProfile()` snapshot the same way; the TikTok actor returns `authorMeta.fans`).
- Weekly roll-up (Monday: week-over-week per model) — trivial from the same tables.
- Reach/impressions/saves need her IG Insights (the `insights` module's screenshot flow) — public scraping cannot see them.
