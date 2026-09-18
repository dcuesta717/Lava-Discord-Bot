# Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026)

Written for Dan and Marissa. No technical background needed. Everything here was checked against the bot's actual
configuration on Sep 18, 2026; where something could not be confirmed it says **unverified**.

**Words used in this doc**
- **The bot** — Lava Bot in Discord.
- **Apify** — the service that fetches Instagram posts (video, caption, numbers) for us. Every fetch costs a few cents.
- **Claude** — the AI that judges the videos, writes the notes, and chats with you as Lava Bot.
- **Scheduled job** — something the bot does by itself at a set time every day.
- **Restart** — the bot switching off and back on (about 2 minutes). Some changes need one; see the Dials section.
- **Home time** — the bot's clock. It is New York time by default (unverified whether the live setting differs). Anything
  "for her" runs on the creator's own time zone instead. Right now only one creator is loaded — Aaron Pilk, New York time,
  lanes golf + funny — so "each creator" currently means one set of channels.

---

## 1. A normal day, hour by hour

| Time (home time unless noted) | What happens | What you see in Discord |
|---|---|---|
| all day, every 15 seconds | The bot checks its reminder list (live check-ins, away replies) and fires anything due. | Nothing unless a reminder is due. |
| every 30 min | Google Drive watcher: any open content request whose folder got new files is marked uploaded. **Only if Drive is connected — unverified.** | "📥 @owners **Her Name** uploaded N file(s) for request #id" in #content-requests-inbox. |
| 06:15 | Instagram snapshot of every creator via Apify: follower count + her latest posts. New posts get a folder/format label from Claude. | `reports snapshot — 1/1 accounts` in #ops-log. |
| 07:00 (her time) | Her daily numbers. | "📊 **your numbers — Fri Sep 18**" in her #🔔-notification: followers ±, what she posted yesterday, 7-day averages, best post. |
| 07:00 | Owners' digest. | "☀️ **Daily report — Friday Sep 18**" in #daily-report: who didn't post, who did, engagement leaderboard, follower movers, content mix. |
| 07:00 | **Content Library scout** (details in section 2): Apify pulls recent reels for every folder's seed accounts + hashtags and for the 7 reference creators → off-market videos dropped → Claude judges the top 8 per folder → up to 3 posted per folder. | `library scouted — N posted across M folders` in #ops-log. New posts appear in the folder channels under 🎬 CONTENT LIBRARY. |
| 07:00, right after the scout | **Routed picks**: every creator with lanes gets up to 3 new library videos from her lanes (posted in the last 3 days, never sent to her before). | "🔥 **today's picks for you** — trending in your lanes…" in her #💬-general-chat, one **📋 Copy #n to my board** button per pick. `library picks-delivered` in #ops-log. If she has no lanes or nothing new, nothing is sent. |
| 07:00, right after the picks | **Trend radar**: a sound or hashtag seen ≥4 times today and ≥3× its 7-day average (max 3 per day, once per 14 days each). | "🔥 **trending right now** — #tag · N reels today … **how to ride it:** …" in #agency-lounge and #daily-report. Often nothing. |
| 07:30 | **Event ideas**: for any holiday/moment inside its lead window, 5 ideas per creator in that event's lanes. **Nothing is due between Sep 18 and Sep 25** (next is Halloween, ideas start Oct 10) unless you add a moment with `/event add`. | Ideas in her #💬-general-chat; "🗓️ **event ideas sent:** …" in #daily-report. |
| 10:00 (her time) | Her personal reels scout: her own seed list → Apify → Claude → her 🎬-reels-copy-board. | New posts on her board with ✅ on drive / 📤 already posted / ❌ skip buttons. `reels scouted` in #ops-log. |
| Monday 09:00 (her time) | Asks her for the Instagram Insights screenshot for last week. (Mon Sep 21 this week.) | "👋 hey Aaron! can u send a screenshot of ur **instagram insights**…" in her #🔔-notification. |
| Tuesday 12:00 (her time) | Reminder if the screenshot never came. (Tue Sep 22.) | "still need that insights screenshot…" in her #🔔-notification + "📉 … hasn't sent insights" in #live-alerts. |
| Friday 11:00 (her time) | Nudge if 3+ reels are untouched on her board. (Fri Sep 18 and Sep 25.) | "👀 N reels waiting on your board…" in her #💬-general-chat. |
| Friday 17:00 | Week in review for everyone. | "🔥 **week in review**" in #agency-lounge: who sent numbers, most reels knocked out, most live time. Never money. |
| Sunday 06:00 | **Weekly profile refresh**: re-researches every creator (Apify + Claude) and rewrites her profile, imported captions and seed list. Her approved voice is not touched. **This causes a restart** (see below). Sun Sep 20 this week. | "🔄 **weekly profile refresh** — Aaron Pilk: N posts · x/wk · lanes …" in #daily-report. `models weekly-refresh` in #ops-log. |
| whenever she runs `/live-started` | 40 min later: "Are you still on LIVE?" with Yes / No buttons; Yes → asks again every 30 min; no answer for 2 h → auto-ended. | "🔴 @owners **Her Name is LIVE**" then "⚫ … ended live · N min" in #live-alerts. Lives ≥ 60 min get a one-liner in #agency-lounge. |
| whenever she asks a question in her channel | Away-reply (default mode "auto"): if no owner answers within 15 minutes the bot answers routine questions itself; money/contract/drama go to #girls-questions instead. | "🤖 **Lava Bot** here while Dan's away — …" in her channel; escalations in #girls-questions. |

Nothing is ever posted to Instagram or TikTok by itself; posting always needs a human tap on a preview card.

### When the bot restarts (a crash, or a change that needs one)
1. Slash commands are re-registered; the staff channels and the library folders are checked and created if missing.
2. The reminder list is re-read from the database, so live check-ins and away replies that were pending still fire.
3. **A saved-collections import that was in progress resumes by itself** and keeps going from the next un-done video.
4. Any one-off "boot job" the technical partner queued (a purge, or an import) runs once and is then cleared.
5. A creator whose onboarding finished during the restart is welcomed in her #💬-general-chat, gets her first reels,
   picks and numbers right away, and any videos Dan saved specifically for her land on her board.
6. **Scheduled jobs do not catch up.** If the bot was off at 07:00, that day's scout/report simply does not happen until the
   next 07:00 (or until you run `/library scout` / `/report` by hand).

---

## 2. The Content Library, end to end

The library is the section everyone can see: **#📥-library-inbox** plus one folder channel per genre (🎭-skits, 💃-dance,
👯-collabs, 🏊-pool, 🏖-beach, 💬-words-on-screen, 💋-big-boobs, 🎙-podcast-questions, ⛳-golf, 🏋-gym-girl, 😂-funny,
🔄-transitions, 🚗-car, 🌟-personality). Every post is one video a girl can watch and copy.

### The three ways a video gets in
1. **The daily scout (07:00).** Per folder, Apify pulls up to 15 recent reels per hashtag and 6 per seed account (last 7 days),
   plus 6 per reference creator (@cecerose @avaxreyess @sophieraiin @juliafilippo_ @arikytsya @jellybeanbrains3 @tak0bell,
   filed wherever they belong). A seed account that has been 👎'd down to a low weight is skipped.
2. **Pasting a link in #📥-library-inbox** (or `/library add`). Any Instagram/TikTok link. Words after the link are a hint:
   `…/reel/… golf` steers it to golf; a sentence steers the notes. The bot reacts ⏳ while working, then ✅ (filed),
   ♻️ (already in the library) or 🚫 (not library material), and replies with where it went or why not.
3. **Dan's saved collections import** (`/library import`). The bot reads the Google Sheet (one row per saved video: collection,
   link, author), queues every link, and works through them in the background — about 12 seconds per video, progress every
   25 videos in #ops-log, so ~800 videos take roughly 3 hours. It resumes after a restart and never re-does a finished link.
   Collection names are matched against rules: some force a folder ("skit" → Skits, "^dance" → Dance, "pool", "beach",
   "big boobs", "words on screen", "podcast|rage bait", "golf", "gym|workout", "transition", "^car", "pick me|personality",
   "funny"), some only steer Claude's notes ("visual hook", "audio hook", "engagement", "just pics", …), and one is skipped
   outright ("owen" — a male creator). Collections named for a person in the people list (leah, josie, amari, bryce, morgan,
   steve) are tagged "saved for her".

### The judging chain, in order
1. **Duplicate check** — a link already in the library is never fetched or judged again.
2. **Market filter (no AI, free).** Dropped if the caption/hashtags are mostly non-Latin script, read as Spanish/Portuguese/
   Italian/French/German/Dutch/Indonesian/Tagalog/Turkish, or contain a term from the exclude list (other-country tags like
   #london #toronto #india, regional platforms, other-language tags). For the scout this is a hard drop ("off-market" in the
   summary). For inbox pastes and the saved import it is only a warning passed to Claude.
3. **Claude with the cover picture.** Claude sees the caption, author, numbers and the cover frame, plus the agency playbook
   and the taste profile, and returns: keep yes/no, the folder (plus up to 2 secondary folders), a 0–1 score, a title, "why it
   works", "how to copy it", and — when rejected — a short reason.
4. **Score threshold — scout only.** Scouted videos need score ≥ 0.6 and only the top 3 per folder are posted. Inbox pastes
   and saved-collection videos are posted whenever Claude says keep, whatever the score (the saved import tells Claude
   "the owner saved this — keep it unless it is unusable"). A forced folder from a rule or a hint always wins over Claude's
   folder choice, but never over a rejection.
5. **Posting.** The video is re-uploaded so it plays inline (cover image + link if it is too big), posted in its folder (and
   in the secondary folders too), with the folder tags applied.

### What a post looks like
Title = the format (what shows in the grid). Body: **why it works:** … / **how to copy it:** … / 👤 @author · ❤️ likes ·
💬 comments · ▶️ views · date / the source link / the video. Buttons: **🔥** · **👎** · **📋 Copy this**.

### The buttons and what each one teaches the bot
- **🔥** — one vote per person. Counts on the button. Also nudges the seed-account weight of that video's author **up** by
  0.1 (if the author is on a scout list), so the scout trusts that account a bit more. Votes also rank the "hottest" list in
  `/library stats` and put a video higher in the routed picks.
- **👎** — the opposite: weight **down** by 0.1. An account whose weight falls below 0.3 is skipped by the scout entirely
  (that takes about eight 👎 from a starting weight of 1.0). Nothing is deleted.
- **📋 Copy this** — a creator taps it → the video goes to her 🎬-reels-copy-board, re-judged for her with a brief. An owner
  taps it → picks which creator. The button shows how many times it was copied.

Votes and copies are the only in-Discord signal that tunes the scout today. They do **not** change the judging rules —
those live in the files listed in section 4.

### The routed morning picks
Right after the scout, each creator with lanes gets up to 3 videos from her lanes (main folder or secondary tag), posted in
the last 3 days, best score first, that she has not received before — in her #💬-general-chat with a Copy button each.
`/library picks` (or "@Lava Bot send the picks") sends them now.

### What the bot learns from the saved collections (after every import run)
1. **Seed accounts** — any author Dan saved 2+ times in the same folder becomes a scout seed for that folder, weighted
   0.9 + 0.1 per save (max 1.5). The daily scout then scans the people whose content he actually copies.
2. **Taste profile** — Claude reads the whole imported set (up to 260 videos) and rewrites "What the owner saves": the
   common thread, per-folder formats, house styles, trusted accounts, what he never saves. Every judging prompt from then on
   reads it next to the playbook. **Saving it causes a restart** (~2 min).
3. **Per-girl collections** — videos in a collection named for a girl land on her board with a note the moment she is
   onboarded.
"@Lava Bot relearn from the library" redoes steps 1–2 without importing anything new.

### House rules (apply to every video, whatever the source)
**Reject by default.** A video is kept only if all of these hold: sexualized but Instagram-safe (revealing outfit, bikini,
lingerie, suggestive — no nudity); a solo woman or women together, adults only; **English** caption AND on-screen text;
**made in the United States**; confident, flirty energy like the reference creators; a format a girl with a phone can copy
this week; a reason men engage you can name. Hard rejects: a man on camera at all, kids/families/couples, fully-clothed
lifestyle, modest outfits with no sex appeal, non-English text, non-US setting, ads, motivational/business talking heads.
Every folder still needs sex appeal (a plain golf tip, a clothed pool day, a funny girl in a hoodie are out).

---

## 3. What the owners do each day during tuning (Sep 18–25)

**Morning (after 07:30)**
- [ ] Open #daily-report and #ops-log. Skim the scout line (`N posted across M folders`) and any `failed`/`errors`.
- [ ] Open each library folder that got new posts. Tap **🔥** on anything you'd actually send a girl, **👎** on anything that
      should not be there. Aim for a vote on every new post this week — that is the training signal.
- [ ] Check the picks in each creator's #💬-general-chat: are they the right lanes? the right vibe?
- [ ] Paste 3–5 links you saved yourself into #📥-library-inbox and check where they landed and what the notes say.

**Anytime**
- [ ] `/library stats` — count per folder + hottest posts. A folder with many 👎 means its description or seeds are wrong.
- [ ] `/library import status:true` — how the saved import is going (running or not; per collection: N filed / dupe /
      skipped / failed / queued).
- [ ] `/library source list` — what each folder's scout is scanning.

**Evening**
- [ ] Send feedback (below) in one message. Small, specific, one thing at a time.

### Slash commands you will use
| Command | What it does |
|---|---|
| `/library stats` | counts per folder + hottest posts |
| `/library import` `[collection:]` `[status:true]` | start the saved import (or one collection by partial name), or show progress |
| `/library scout` `[folder:]` | run the scout now (takes minutes, costs Apify credits; summary in #ops-log) |
| `/library picks` `[model:]` | send today's picks now |
| `/library add url: [folder:] [note:]` | file one video, optionally forcing the folder |
| `/library source add folder: value:@handle #tag` / `remove` / `list` | manage what the scout scans per folder |
| `/library purge origin: confirm:True` | **deletes** videos + posts (scout / inbox / saved / everything). Do not use during tuning — see section 6 |
| `/report` `[model:]` `[refresh:true]` | today's numbers now |
| `/event list` / `add` / `ideas` / `remove` | the moments calendar |
| `/model list` / `lanes slug: lanes:` | who is loaded; change her folders (needs a restart) |
| `/away mode:on|auto|off [delay:]` | cover-for-Dan mode |

### Talking to the bot instead (owners only)
@mention **Lava Bot**, reply to one of its messages, or DM it — anywhere except a creator's private channels. It understands
plain English and runs the matching action. Things it can do from chat (the names in brackets are what it calls them):
run the library scout [run_library_scout] · send picks [send_library_picks] · add seed accounts/hashtags to a folder
[add_library_source] · file a video [add_library_video] · library stats [library_stats] · purge library videos
[purge_library, asks once first] · import my saved collections [import_saved_collections] · import status
[saved_import_status] · relearn from the library [relearn_from_library] · today's numbers [daily_report] · list/add
events, send event ideas [list_events, add_event, send_event_ideas] · list creators, set a creator's lanes, show her profile,
kick off her morning jobs now, onboard or remove a creator [list_models, set_model_lanes, show_model_profile,
kickoff_model, onboard_model, remove_model] · her personal reels scout [scout_reels_for_model] · away mode
[set_away_mode] · owners [add_owner, remove_owner, list_owners].

Phrasings that work: "@Lava Bot import my saved collections", "@Lava Bot how's the import going", "@Lava Bot run the scout
for golf", "@Lava Bot send Aaron his picks", "@Lava Bot add @somegolfgirl and #golfgirls to the golf folder", "@Lava Bot
what's in the library", "@Lava Bot what's coming up on the calendar", "@Lava Bot I'm off today, cover for me".

### How to give feedback that actually tunes the system
The judging rules are files, not settings in Discord, so wording feedback precisely lets the technical partner change the
right file in one edit. Send it in the chat with Claude (the technical partner), one point per line, with a link when you have one:
- **Too strict / too loose:** "Too strict on *golf* — it rejected this <link>, a skirt on the course should pass." /
  "Too loose on *funny* — this <link> is a hoodie joke with no sex appeal." → changes the folder description or the rules.
- **Wrong folder:** "This <link> belongs in *words-on-screen*, not *personality*." → changes a folder description or a
  collection rule. (Meanwhile, `/library add url: folder:` re-files it by hand.)
- **Never this account / always this account:** "Never @handle." / "Always scan @handle for *pool*." → today the bot has
  no block list for accounts; the technical partner adds one or removes the seed. You can add seeds yourself with
  `/library source add`.
- **Market:** "This <link> is Canadian/British — should have been dropped." → a term is added to the exclude list.
- **Notes quality:** "The 'how to copy it' lines are too vague — I want outfit + setting + text on screen every time."
- **Collections:** "My 'Rage bait' collection should go to *podcast-questions*." / "Skip the 'X' collection."
- **Volume/cost:** "3 per folder per day is too many/few." / "Scout at 8 instead of 7."
Avoid "the bot is bad at X" without a link — a rule can only be fixed against an example.

---

## 4. Dials that change behavior without touching code

Every one of these is a plain text file. Changing any of them means a restart (~2 minutes) — the only files that do not
restart the bot are the docs, README, the code map and the automation config (verified Sep 18 against the hosting
service's watch rule: `**`, `!/graphify-out/**`, `!/docs/**`, `!/README.md`, `!/CLAUDE.md`, `!/.github/**`). **Do not
restart while an import is running** (section 6).

| File | Controls | Example change | Restart? |
|---|---|---|---|
| `library/genres.yaml` → `genres[]` | the folders: slug, name, emoji, **description** (the only definition Claude sees), default hashtags, active | sharpen the golf description; add a folder; set `active: false` (never delete a slug that has posts) | yes |
| `library/genres.yaml` → `scout.cron` | when the daily scout runs (home time) | `"0 8 * * *"` = 8 AM; `"0 7 * * 1,3,5"` = Mon/Wed/Fri only | yes |
| `library/genres.yaml` → `scout.min_score` | the bar for scouted videos (0–1) | 0.6 → 0.7 for fewer, stricter posts | yes |
| `library/genres.yaml` → `scout.keep`, `classify_top`, `per_hashtag`, `per_account`, `picks_per_model` | posts per folder per day (3), candidates Claude judges per folder (8), Apify results per hashtag (15) / per account (6), picks per creator (3) | `keep: 2`; `classify_top: 12` costs more Claude, `per_hashtag: 8` halves Apify | yes |
| `library/genres.yaml` → `scout.reference_accounts` | the 7 creators whose vibe defines "library material"; scanned every run and named in the prompt | add/remove a handle (no @) | yes |
| `library/collections.yaml` → `sheet`, `pace_ms`, `batch` | which Google Sheet is the saved-collections input; pause between videos (3500 ms); videos per Apify call (8) | slower pace if Instagram/Discord complain | yes |
| `library/collections.yaml` → `people`, `rules` | which collection names mean "for her"; which names force a folder / steer Claude / are skipped | add `- match: "rage ?bait"` → `genre: podcast-questions`; flip `owen` from `skip: true` to a `hint:` | yes |
| `library/market-exclude.txt` | off-market terms (one per line; `#tag` matches whole hashtags, plain words match inside captions) | add `#lisbon` | yes |
| `prompts/library.classify.md` | Claude's judging rules for the library (accept/reject lists, per-folder lens, output format) | loosen "modest outfit" rule for golf | yes |
| `prompts/reels.classify.md` | Claude's judging rules for a creator's personal reels board (categories, same house rules) | | yes |
| `knowledge/industry.md` | the agency playbook injected into every judging/research/idea prompt (audience, what performs, what "library material" means, per-folder lens) | edit the per-folder lens | yes |
| `knowledge/taste.md` | **bot-written** taste profile from Dan's saves; injected next to the playbook (up to 40 % of that budget). Rewritten after every import; hand edits are overwritten | don't edit by hand — re-run the import or "relearn" | yes (the bot restarts itself when it writes it) |
| `models/<slug>/model.yaml` → `lanes` | which folders a creator belongs to → her picks and event ideas. Also `timezone`, `live.*` delays, `insights.cron` | `/model lanes slug:aaron-pilk lanes:golf, funny` does this for you | yes |
| `knowledge/events.yaml` | the recurring moments calendar (dates, lead days, lanes, angle). One-offs: `/event add` (no restart) | change Halloween's angle | yes |

---

## 5. Where to look when something seems off

- **#ops-log** — one line per bot action: `` `library` **scouted** — 5 posted across 14 folders ``, `` `library`
  **saved-import-progress** — 50/812 — 41 filed, 3 already in, 5 skipped, 1 failed (now: Skits) ``, `` `library`
  **saved-import-done** … — learning from the set now ``, `` `library` **learned** — N seed account(s) → the scout, taste
  profile written ``, `` `operator` **ran** `` (something you asked for in chat), `` `reports` **snapshot** ``, `` `models`
  **weekly-refresh** ``. If a morning line is missing, the job did not run.
- **Statuses in `/library import status:true`** (per collection):
  - **queued** — not done yet (waiting, or the run was interrupted and will resume on the next restart).
  - **filed** — posted into a folder.
  - **dupe** — already in the library from before (inbox, scout or an earlier run); it just got tagged with the collection.
  - **skipped** — Claude rejected it (the note starts "Claude: …" with the reason) or the collection is skipped by rule.
  - **failed** — Apify could not return it (private account, deleted post, or a hiccup) or the download/post failed.
    Re-running the import does **not** retry these; ask the technical partner to re-queue them.
- **Claude's reject reasons** (`reject_reason`) are ≤ 8 words naming the rule that fired — "man on camera", "fully clothed
  lifestyle", "modest outfit", "non-English text", "not US". They appear in the inbox reply after 🚫 and in the import
  status notes. Reading a day's reasons is the fastest way to see whether a rule is too strict.
- **"off-market"** in a scout summary = dropped by the market filter before Claude (language/script/country term). The
  count tells you how much of what Apify found was not US/English.
- **"skipped" in a scout summary** = Claude said no, or the score was under the bar, or the folder name came back wrong.
- **"errors" in a scout summary** = a seed account or hashtag Apify could not fetch that run.
- **⚠️ "couldn't be fetched"** on an inbox paste = private account, deleted post, or Apify hiccup — try again in a minute.
- **A creator got no picks** = she has no lanes set, or nothing new in her lanes in the last 3 days, or she already got it.
- **Slash command says "APIFY_TOKEN is not set"** = the Apify connection is missing; tell the technical partner.

---

## 6. Do NOT do during tuning

- **No code changes and no rule/protocol changes on your own.** Send feedback (section 3); one person makes the edit.
- **Never clear folders or delete videos without announcing it in chat and getting a yes.** `/library purge` and
  "purge the library" delete forum posts for real. Purged saved-collection videos go back to "queued" and would be
  re-imported at cost.
- **Do not restart the bot while an import is running.** It resumes, but the batch in flight is re-fetched and paid for
  again. This includes things that restart the bot indirectly: `/model lanes`, ✏️ Notes / ✅ Approve in #new-girl-reviews,
  "relearn from the library", and the Sunday 06:00 weekly refresh (see Things to watch). Check
  `/library import status:true` first: "⏸ not running" is the green light.
- **Do not hammer Instagram.** One `/library scout` a day at most on top of the 07:00 run; do not lower `pace_ms`; do not
  paste hundreds of links at once — the import exists for that.
- **Only the collections Dan named.** Do not add other people's collections or new sheets to the import this week.
- **No filtering creators by race or religion.** The bot filters by country, language and on-camera gender only, and the
  judging rules say the same; exclusions by race or religion are not built and will not be. (Five dress-code words that
  crept into the exclude list — see "Things to watch" #5 — are slated for removal when changes are allowed again.)
- **No `/model add` / `/model remove` / `/model refresh` this week** unless agreed — each one restarts the bot.

---

## 7. For Claude / the technical partner

Paths, so a future session finds things fast. Times: all crons in `ctx.cron(name, spec, tz, fn)` (`src/discord/context.ts:127`).
- Boot & restart behavior: `src/index.ts`; durable timers `src/lib/timers.ts` (15 s poll of `bot.timers`); staff channels
  `src/modules/setup/index.ts`; library folders + boot jobs (`bot.settings → library.boot_jobs`, `purge:<origin>` /
  `import:<collection>`) `src/modules/library/index.ts:126-141`; import resume `src/modules/library/saved.ts:144-153`
  (`bot.settings → library.import.active`); onboarding resume + welcome + `model:live` `src/modules/models/index.ts:49-107`.
- Schedules: library scout `library/genres.yaml:9` (`0 7 * * *`, DEFAULT_TIMEZONE) registered at
  `src/modules/library/index.ts:143` (then `deliverPicks()` :807, `radar()` :772); reports `src/modules/reports/index.ts:25-26,52,60,75`
  (`15 6 * * *` snapshot, `0 7 * * *` per model in her tz + owners); events `src/modules/events/index.ts:22,48` (`30 7 * * *`);
  reels per model `src/modules/reels/index.ts:91,95` (`0 10 * * *`, `0 11 * * 5`, her tz); insights per model
  `src/modules/insights/index.ts:41,47` (`model.yaml → insights.cron` `0 9 * * 1`, `reminder_cron` `0 12 * * 2`, her tz);
  agency `src/modules/agency/index.ts:15` (`0 17 * * 5`); weekly refresh `src/modules/models/index.ts:110` (`0 6 * * 0`);
  Drive watcher `src/modules/requests/index.ts:95` (`*/30 * * * *`, only if `ctx.api.drive.enabled`); live delays
  `src/config/models.ts:60-65` (40/30/120 min). `DEFAULT_TIMEZONE` default `src/config/env.ts:66`.
- Library pipeline: `ingest()` `src/modules/library/index.ts:525` (dupe → Apify → `marketFilter` → `classify` → `post`);
  scout `:651` and `scoutQueries()` `:674` (market filter hard-drop :699, `classify_top` :706, `min_score` :711, `keep` :715);
  engagement rank `:724`; votes/weights `:429-443` (±0.1, clamp 0–2; scout skips weight < 0.3 at :653); copy → bus
  `library:copy` `:498-513` → `src/modules/reels/index.ts:142`; picks query `:817-823`; trend radar `:750-803`.
- Saved import: `src/modules/library/saved.ts` — sheet reader `:103`, `start()` `:195`, `run()` `:222` (statuses set by
  `mark()` `:317`; progress every 25 `:302`), `status()` `:321`, `learn()` `:331` (seed accounts ≥ 2 saves `:332-340`,
  taste prompt `prompts/library.taste.md`, writes `knowledge/taste.md` + GitHub commit `:356-362`), person collections `:367`.
  Config schema `:32-38`; rules/people `library/collections.yaml`.
- Judging: `prompts/library.classify.md` (+ `{{industry}}` from `src/lib/industry.ts` = `knowledge/industry.md` + up to 40 %
  `knowledge/taste.md`, 60 s cache; `{{references}}` from `genres.yaml`); `prompts/reels.classify.md`; market filter
  `src/lib/market-filter.ts` + `library/market-exclude.txt` (60 s cache). Prompts cached only when `NODE_ENV=production`
  (`src/lib/prompts.ts:15`).
- Operator chat: `src/modules/operator/index.ts` (owners only, ≤ 6 tool turns, `prompts/operator.system.md`); every
  `ctx.action(...)` is a tool — list with `rg "ctx.action\('" src`.
- Restart trigger: any commit outside `docs/`, `README.md`, `CLAUDE.md`, `graphify-out/`, `.github/` (CLAUDE.md:41; Railway
  watch patterns are configured in Railway, not in `railway.json`). The bot itself commits: `knowledge/taste.md` (learn),
  `models/<slug>/*` (onboard, refresh, lanes, notes, approve, weekly refresh) — each of those redeploys.
- Other docs: `docs/content-library.md`, `docs/operator-chat.md`, `docs/daily-reports.md`, `docs/events-and-trends.md`,
  `docs/runbook.md`.

---

## Things to watch (noticed while writing this; nothing was changed)

1. **Sunday Sep 20, 06:00 — the weekly profile refresh will restart the bot.** It saves each creator's files, and that
   save restarts the bot. If the saved import is still running then, it is interrupted and resumes after the restart (one
   Apify batch re-fetched). Either finish the import before Saturday night or accept the small re-fetch.
2. **Importing one collection ends up importing all of them.** `/library import collection:X` queues the whole sheet, runs
   only X, then the learning step saves `knowledge/taste.md` → restart → on boot the import resumes with *everything*
   still queued (`saved.ts:144-153` resumes without the `only` filter). Expect the full run after any partial one.
3. **"Relearn from the library" also restarts the bot** (it saves `taste.md`). Do not run it while an import is running.
4. **The current taste profile (`knowledge/taste.md`) was learned from 8 videos in one collection.** It lists "skits" only, all
   accounts at 1×, and says he accepts "US/UK/Canada/Australia markets" — which contradicts the US-only rule — and it is
   injected into every judging prompt. It will be overwritten by the next full import; until then it is skewing judgment
   toward skits.
5. **`library/market-exclude.txt` contains dress-code/cultural terms** (`hijab`, `hijabi`, `abaya`, `bhabhi`, `saree`, lines
   29–33). Claude added them on Sep 17 as "market terms". The stated rule is country/language/on-camera gender only, and
   these five words filter by a religious/cultural marker instead — they cross the line Claude told the owner it would hold.
   Decision (Claude, Sep 18): remove the five lines in the first change after the tuning window; the country/city hashtags
   and other-language tags stay. Noted so it is not forgotten.
6. **Failed import rows are never retried automatically.** `failed` rows stay `failed`; re-running the import only touches
   `queued` rows. Someone has to reset them to `queued` in the database.
7. **The score bar applies to the scout only.** Inbox pastes and saved-collection videos are posted whenever Claude says keep,
   even with a score below 0.6 — expected for Dan's saves, maybe surprising for inbox pastes.
8. **Missed jobs are not caught up.** A restart spanning 07:00 loses that day's scout, picks and report until run by hand.
9. **The only loaded creator is Aaron Pilk**, whose personal reels seeds include `ai`, `automation`, `cats`, `baseball` —
   his 10:00 reels scout will pull off-topic candidates (the house rules will reject most, at Apify/Claude cost).
10. **Doc mismatches:** `docs/runbook.md` says 25 MB uploads (code uses 10 MB unboosted) and "create STAFF channels by hand"
    (the bot creates them); `docs/operator-chat.md` says the bot cannot change owners (it has `add_owner`/`remove_owner`).
11. **The big-boobs folder has no hashtags by design.** Unless it has seed accounts in the database, its own scout does nothing
    (it can still receive videos via the reference creators or the import) — check `/library source list folder:big-boobs`.
12. **Repeated clicks move seed weights.** Each 🔥/👎 press adjusts the author's seed weight by ±0.1 even when the same person
    presses the same button again (`library/index.ts:434-439` — the vote row is overwritten, the weight update is not
    guarded). One person can push an account below the 0.3 cut-off, or up to 2.0, by clicking repeatedly.
