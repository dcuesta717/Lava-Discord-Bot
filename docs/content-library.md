# Content Library — the agency inspiration folders

Dan's problem: he saves reels he likes into Instagram's "saved" folder and forwards them to each girl one by one. Nothing is organised, nothing is searchable, nobody new can browse it.

The library is one Discord section everyone in the agency can see, with **one folder per genre**, where every post is a video a girl can watch and copy. The goal of every video in it: shareable, likeable, and **men comment on it** — top-of-funnel content for creators whose paid content lives elsewhere.

```
📁 🎬 CONTENT LIBRARY                       everyone in the agency
 ├ #📥-library-inbox                         paste IG / TikTok links → filed automatically
 ├ 🎭-skits  💃-dance  👯-collabs  🏊-pool  🏖-beach  💬-words-on-screen  💋-big-boobs
 ├ 🎙-podcast-questions  ⛳-golf  🏋-gym-girl  😂-funny  🔄-transitions  🚗-car  🌟-personality
 └ (one FORUM channel per genre, gallery layout = a grid of video thumbnails on mobile)
```

Genres live in **`library/genres.yaml`** (name, emoji, description the classifier uses, default hashtags). Add or rename one there; the bot creates/renames the folder on next boot. Never delete a slug that has posts — set `active: false`.

## What a post looks like

Forum post title = the hook / format (that is what shows in the grid). Body:

```
why it works:   she asks a question the guys in the comments can't not answer
how to copy it: golf cart, phone on the dash, text "rate my swing 1-10", 3 swings cut on the beat, no talking
👤 @somegolfgirl · ❤️ 41k · 💬 2.1k · ▶️ 1.8M · Sep 14
<source link>
[video attached]           [🔥] [👎] [📋 Copy this]
```

- The mp4 is re-uploaded (≤ the server's upload limit — 10 MB unboosted, 50 MB at boost level 2) so it plays inline and shows a thumbnail in the grid. Larger videos get the cover image + link instead.
- A video that clearly belongs in two folders (gym + words on screen) is posted in both; the secondary folders are also applied as forum tags so the girls can filter.
- **🔥 / 👎** are votes (one per person). They also nudge the *weight* of the seed account the video came from, so the scout learns whose content the agency actually wants.
- **📋 Copy this** — a model taps it → the video lands on her own `🎬-reels-copy-board` re-classified into her categories with a recreate brief (`modules/reels`). An owner taps it → picks which model. The `copies` count shows on the button.

## Two ways in

**Inbox.** Anyone pastes a link in `#📥-library-inbox` (from the IG share sheet: Share → Copy link). Optional words after the link are a hint (`… golf` forces the folder; `… this one's the words on screen thing` steers the notes). Within ~1 minute the bot reacts ✅ and replies with where it filed it. ♻️ = already in the library. 🚫 = not library material (Claude's call: brand ad, nothing replicable, not IG-safe). Same thing from anywhere with `/library add url: folder: note:`.

**Scout (daily, `scout.cron` in genres.yaml, DEFAULT_TIMEZONE).** Per genre: seed accounts (`/library source add folder:golf value:@handle @handle2`) + hashtags (`genres.yaml` + `#tags` added the same way) → Apify (`apify/instagram-scraper`, `resultsType: reels` — verified: hashtag + profile pages return real reels with play/like/comment counts) → recent reels → ranked by `(comments×5 + likes + views/100) × recency` → top `classify_top` go to Claude one at a time with the cover frame → those with `keep` and `score ≥ min_score` → top `keep` posted. Seed accounts with weight < 0.3 (repeatedly 👎'd) are skipped.

`/library scout` runs it now (owners). `/library stats` shows counts per folder and the hottest posts. `/library source list` shows the scout lists.

## Classification

`prompts/library.classify.md` gets the genre list from `genres.yaml`, one candidate (caption, author, likes/comments/views, post date) and the cover frame as an image. It returns `keep`, primary `genre`, up to two `also` folders, a 0-1 `score` (replicability × why men engage, *not* raw views), `title`, `why`, `copy`, `text_on_screen`. If `text_on_screen` is true it adds `words-on-screen` to `also` automatically.

Tuning: edit the genre `description` lines in `genres.yaml` (they are the only definitions the model sees) and the rules in the prompt. Watch `/library stats` — a folder with lots of 👎 means its description is wrong or its seeds are bad.

## Cost

Apify `apify/instagram-scraper` is pay-per-result (≈ $2.30 / 1 000 results at the time of writing). Defaults: 14 genres × (3 hashtags × 15 + N accounts × 6). With ~5 seed accounts per genre that is ≈ 1 000 results/day ≈ $2–3/day, so budget **$50–90/month**; halve it with `per_hashtag: 8` or a `0 9 * * 1,3,5` cron. Claude classification is ~120 small vision calls/day, well under $1/day.

## Data

- `bot.library_items` — one row per source video (`posts` = every forum/thread it was posted to, `stats`, `score`, `up/down/copies`).
- `bot.library_sources` — seed accounts/hashtags per genre with `weight`.
- `bot.library_votes` — one vote per user per item.
- `bot.settings` `library.category`, `library.inbox`, `library.forum.<slug>` — channel ids; nothing is hand-configured.
- Optional Notion mirror: rows go to the reels database with `Status = library`.

## Not (yet) done

- TikTok in the scout (inbox links work; hashtag scouting is IG only — add a `tiktokPage()` in `integrations/apify.ts` if wanted).
- Automatic expiry (a "trending" video is stale after ~3 weeks). Easy add: weekly cron that archives forum posts older than N days with 0 🔥.
- Per-girl "for you" view (folders she picked as her lanes) — could be a role per genre + pinned message.
