# Architecture

```
 Discord (one Lava guild)                                   Staff-only channels
 ┌────────────────────────────────────────────┐             ┌──────────────────────────┐
 │ 📁 Amari (private)  📁 Model 2  … 📁 Model 15│             │ #live-alerts  (Dan, Marissa)│
 │  #general  🎬board  #custom  #notification  │             │ #content-requests-inbox   │
 │  #resources  🔊call                          │             │ #reels-inbox  #ops-log    │
 │ #agency-lounge (all models + owners)        │             └────────────▲─────────────┘
 └───────────────▲────────────────▲────────────┘                          │
                 │ slash cmds, buttons, modals, messages                    │ alerts, digests
 ┌───────────────┴────────────────┴──────────────────────────────────────┴──────────────┐
 │  lava-discord-bot (Node 20 · discord.js v14 · one process)                             │
 │  BotContext: commands · components · modals · crons · durable timers · bus            │
 │  modules: persona · live · insights · requests · reels · captions · posting · earnings │
 │           · agency                                                                     │
 │  state: Supabase Postgres (schema bot.*)  ── mirror ──▶ Notion databases (optional)    │
 └───┬───────────────┬────────────────┬─────────────────┬───────────────┬────────────────┘
     │ Claude API    │ Apify          │ Google Drive    │ Zernio        │ models/<slug>/
     │ chat, vision, │ TikTok/IG      │ raw → edited →  │ POST /posts   │ voice, sourcing,
     │ JSON          │ scrapers       │ ready-to-post   │ (after ✅)    │ notes, config
```

## Request flows

**Live:** `/live-started` → live_sessions row + two timers (`live:checkin` @40 min, `live:timeout` @120 min) → alert in #live-alerts → check-in buttons → `/live-ended` or 🔴 or timeout → alert + `live:ended` bus event (agency lounge one-liner if ≥ 60 min).

**Weekly insights:** cron (model tz) → ask in #notification → image attachment → 👀 → Claude vision → `weekly_metrics` upsert → reply with numbers + WoW delta → Notion mirror → `insights:parsed` event.

**Content request:** staff `/request` → Claude rewrite (bot voice + consent line) → post in her #resources with Drive folder (auto-created) → `content_requests` row → Drive watcher every 30 min → `uploaded` → ping owners.

**Reels board:** daily Apify per `sourcing/reels-sources.yaml` (+ manual drops in #reels-inbox / `/reel`) → Claude classify + brief → forum thread per category → buttons update `reels.status` → Friday nudge if ≥3 waiting.

**Captions:** `/caption` → `generateCaption()` (examples → 3 candidates → critic → lint, 2 attempts) → approval card → ✅/✏️ → `captions` row + append to `caption-examples.md` → `caption:approved` event.

**Posting:** `/post` (media URL + approved caption id) → preview card in her #general → ✅ → Zernio presign/upload + `POST /posts` scheduled at `when` or next `best_times` slot → `posts` row.

**Earnings:** staff `/earnings` → threshold check (best month / goal / $5k step) → Claude hype line → her #general. Never the lounge.

## Build order (each is a day or less)
1. ✅ core + live + persona (this scaffold compiles; wire tokens and it runs)
2. insights (done in scaffold) — test with a real screenshot
3. captions + voice files for 2 models → tune prompts until Dan approves 8/10 unedited
4. requests + Drive service account
5. reels: Apify actor choice + `normalize()` field mapping for that actor
6. posting: Zernio accounts per model, test one scheduled post on a burner account
7. earnings source (manual now; later: CRM export → cron)
8. agency lounge + weekly report agent

## Deliberate non-goals
- Invoices (Aaron: not important). The `#invoices` channel is not created by setup-server.
- Auto-ending lives by detecting the stream (no reliable API) — the check-in buttons are the fix.
- Posting without a human tap — never.
