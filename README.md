# lava-discord-bot

Discord + Claude automation for Lava Mgmt. One bot, one Discord server, one private category per model (≈15), an agency-wide lounge, and a set of scheduled agents that source reels, write captions in each model's own voice, relay content requests, track lives, parse weekly IG insights, and auto-post through Zernio after a human tap.

Modelled on the Nivo HQ / "Larry The Bot" setup — see `docs/source-analysis/Nivo-Discord-Bot-Analysis.md` for the teardown this repo is built from.

## Layout

```
lava-discord-bot/
├─ CLAUDE.md                  ← read this first if you are Claude Code
├─ src/                       ← the bot (Node 20 + TypeScript + discord.js v14)
│  ├─ index.ts                boot: load models, register commands, start crons
│  ├─ config/                 env + per-model YAML loader
│  ├─ discord/                client, command registry, interaction router
│  ├─ modules/                one folder per feature (see below)
│  ├─ integrations/           anthropic · notion · drive · apify · zernio
│  ├─ db/                     Postgres (Supabase) client + migrations — schema `bot.*`
│  └─ lib/                    logger, cron, time helpers
├─ library/                   ← genres.yaml: the agency-wide Content Library folders (docs/content-library.md)
├─ models/                    ← ONE FOLDER PER MODEL (voice, sourcing, playbooks, config)
│  ├─ _template/              copy this with `npm run new-model -- <slug>`
│  └─ <slug>/
├─ prompts/                   ← every Claude prompt lives here as a .md file, never inline in code
├─ agents/                    ← playbooks for scheduled / Claude Code agents (reels scout, weekly report…)
├─ scripts/                   ← one-off CLI tools (new-model, register-commands, import-captions, setup-server)
├─ docs/                      ← architecture, Discord server template, content library, daily reports, Notion schema, caption voice system, runbook
└─ .github/workflows/         ← CI (typecheck) + deploy
```

## Modules

| Module | Status | What it does |
|---|---|---|
| `live` | implemented | `/live-started` `/live-ended`, 40-min "still live?" check-ins every 30 min, 2 h auto-end, alerts to owners. Timers survive restarts (Postgres). |
| `persona` | implemented | Replies when mentioned / replied to / named in a model's channels; facts-only context block from the DB; hard guardrails in `prompts/persona.system.md`. |
| `insights` | implemented | Weekly ask for an IG Insights screenshot (model-local cron), Claude vision parse, week-over-week delta, reminder if missing, `/my-week`. |
| `requests` | implemented | `/request` → Claude rewrites in the bot's voice + consent line → posted to her #resources with an auto-created Drive folder → Drive watcher flips to `uploaded`. |
| `reels` | implemented | Daily Apify scout per model + manual drops (`#reels-inbox`, `/reel`) → Claude classify + recreate brief → forum thread per category → ✅/📤/❌ buttons. |
| `captions` | implemented | `/caption` → voice files + real examples → 3 candidates → cold critic → deterministic slop lint → approval card (✅ use / ✏️ edit / 🔁 regen / ❌). Learns from every approve/edit. |
| `posting` | implemented | `/post` → preview card → ✅ → Zernio presign/upload + `POST /posts` at `when` or next best slot. Nothing posts without a tap. |
| `earnings` | implemented | `/earnings` (manual MTD for now) → best-month / goal / $5k-step thresholds → one Claude hype line in her #general. |
| `agency` | implemented | `#agency-lounge`: Friday shout-outs (insights sent, reels cleared, live minutes) + long-live one-liners. Never numbers. |
| `models` | implemented | **Onboarding from Discord**: `/model add name user instagram [tiktok]` → her private channels + deep research (Apify profile + ~65 posts → Claude) → `models/<slug>/` committed to GitHub → live after the redeploy. `/model refresh`, `/model lanes`, `/model list`. |
| `reports` | implemented | **7 AM analytics**: nightly Apify snapshot of every model's IG (followers + latest posts, Claude-labelled by lane/format) → her numbers in her #notification, owners' digest in #daily-report (who didn't post, engagement leaderboard, follower movers, content mix). `/report`. See `docs/daily-reports.md`. |
| `library` | implemented | **Content Library** — agency-wide inspiration folders, one forum per genre (`library/genres.yaml`), gallery view. `#library-inbox` drops + daily Apify scout → Claude files each video with "why it works / how to copy it" → 🔥/👎 votes, 📋 Copy this → her board. See `docs/content-library.md`. |

Not yet wired: Drive "Ready to Post" → `/post` automation, Zernio publish-status polling, OF earnings source (CRM export). See `docs/architecture.md` build order.

## Quick start

```bash
cp .env.example .env            # fill in tokens + DATABASE_URL (Supabase → Connect → Transaction pooler)
npm install
npm run register-commands       # pushes slash commands to your guild
npm run dev                     # ts-node with reload
```

Add a model:

```bash
npm run new-model -- jane       # copies models/_template → models/jane
# edit models/jane/model.yaml (discord ids, ig handle, zernio profile, timezone)
npm run import-captions -- jane # pulls her real captions via Apify into voice/caption-examples.md
npm run setup-server -- jane    # creates her private category + channels + role
```

## Knowledge graph (graphify)

`graphify-out/` (graph.json + GRAPH_REPORT.md) is **committed** and refreshed every night by the `graphify` GitHub Action, so any Claude session can orient with `graphify query "…"` / `graphify explain "…"` instead of reading files — fewer tokens, fewer wrong guesses.

```bash
uv tool install graphifyy        # once, on your machine
graphify query "where do library videos get posted"
graphify update . --force        # after big local changes (no LLM); the nightly job does this too
```

## Roles

- **Dan** — owner, bot admin (`BOT_ADMIN_IDS`), approves posts.
- **Marissa** — owner, receives live alerts and content-request pings.
- **Aaron** — builds/deploys.
- Each **model** only sees her own category + the agency lounge.
