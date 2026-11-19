# Graph Report - Lava-Discord-Bot  (2026-11-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1235 nodes · 2045 edges · 111 communities (80 shown, 31 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 143 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `474eff70`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BotContext
- package.json
- aaron-pilk/model.yaml
- Apify
- loadPrompt
- 2. Frame-by-frame walkthrough
- loadPrompt
- Bryce Nelson — profile
- bryce-nelson/model.yaml
- compilerOptions
- saved.ts
- dependencies
- CLAUDE.md — working rules for Claude Code in this repo
- Caption voice system — how captions don't sound like AI
- Voice — <display name>
- deploy
- industryLens
- register
- _template/voice/banned-phrases.md
- discord.js
- caption.generate.md
- persona.system.md
- lava-discord-bot
- src/index.ts
- _template/model.yaml
- register
- Discord server template
- caption.critic.md
- Caption examples
- onboard-model.md
- agents/README.md
- reels-scout.md
- voice-audit.md
- weekly-report.md
- models/README.md
- _template/notes.md
- _template/playbooks/README.md
- _template/voice/hooks.md
- library.classify.md
- Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026)
- Aaron Pilk — profile
- graphify.yml
- bryce-nelson/voice/banned-phrases.md
- How OnlyFans creators win on social media — the playbook the bot works from
- aaron-pilk/voice/banned-phrases.md
- Voice — Aaron Pilk
- sections
- Claude
- Voice — Bryce Nelson
- Away-reply — the bot covers for Dan
- What the owner saves — taste profile (learned 2026-09-18)
- What the owner saves — taste profile (learned {{date}})
- Daily reports (7 AM)
- away.reply.md
- Operator chat — owners just talk to the bot
- scout
- Events & trend radar
- Caption examples
- operator.system.md
- Staff notes — Aaron Pilk (private — fed to the persona as background, never quoted to her)
- aaron-pilk/playbooks/README.md
- aaron-pilk/voice/hooks.md
- steps
- Drive
- events
- instagram
- instagram
- anthropic.ts
- Creator archetypes ("buckets") — Dan's niche profiles for the girls
- Caption examples
- Staff notes — Bryce Nelson (private — fed to the persona as background, never quoted to her)
- bryce-nelson/playbooks/README.md
- bryce-nelson/voice/hooks.md
- instagram
- collections.yaml
- FAQ — what Lava Bot may answer on Dan's behalf
- context.ts
- away/index.ts
- scripts
- register
- Incident — the Content Library folders emptied twice (Sep 17, 2026, evening)
- canonicalUrl
- market-filter.ts
- Backlog — after the tuning window (verified against main @ 01bbe2b, 2026-09-18)
- buckets
- bryce
- Creator watch list — the accounts Dan wants the scout to follow
- girls
- josie
- leah
- morgan
- 2. Restart & concurrency resilience
- The girls — niches and growth plans (Claude's review, Nov 18, 2026)
- kalena
- madi
- naomi
- natt
- shannon
- Notion schema (optional mirror)
- apify-client
- pino-pretty@^11.2.2
- postgres

## God Nodes (most connected - your core abstractions)
1. `register()` - 48 edges
2. `register()` - 44 edges
3. `BotContext` - 39 edges
4. `loadPrompt()` - 36 edges
5. `discord.js` - 27 edges
6. `canonicalUrl()` - 23 edges
7. `main()` - 22 edges
8. `Model` - 20 edges
9. `register()` - 19 edges
10. `register()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `House rules — reject by default; US, English, women only, sex appeal required` --references--> `classify()`  [INFERRED]
  docs/content-library.md → src/modules/library/index.ts
- `Why it could happen (root causes, all still present by the owner's order)` --references--> `purge()`  [INFERRED]
  docs/incidents/2026-09-17-library-wipe.md → src/modules/library/index.ts
- `5. Still open (everything else is decided — see §4.0)` --references--> `normalize()`  [INFERRED]
  docs/source-analysis/Nivo-Discord-Bot-Analysis.md → src/integrations/apify.ts
- `Request flows` --references--> `generateCaption()`  [INFERRED]
  docs/architecture.md → src/modules/captions/generate.ts
- `Could not confirm (kept out of the tables or marked partial)` --references--> `canonicalUrl()`  [INFERRED]
  docs/backlog-post-tuning.md → src/integrations/apify.ts

## Import Cycles
- None detected.

## Communities (111 total, 31 thin omitted)

### Community 0 - "BotContext"
Cohesion: 0.15
Nodes (15): Gotchas, BotContext, register(), register(), register(), register(), classifyAndPost(), postToBoard() (+7 more)

### Community 1 - "package.json"
Cohesion: 0.16
Nodes (15): devDependencies, tsx@^4.19.1, @types/luxon@^3.4.2, @types/node@^20.16.10, typescript@^5.6.2, engines, node, name (+7 more)

### Community 2 - "aaron-pilk/model.yaml"
Cohesion: 0.05
Nodes (43): active, caption, lowercase, max_chars, max_emoji, max_hashtags, custom, general (+35 more)

### Community 3 - "Apify"
Cohesion: 0.07
Nodes (18): Architecture, Build order (each is a day or less), Deliberate non-goals, Request flows, Adding integrations, Daily ops for Dan/Marissa, Deploy, First run (+10 more)

### Community 4 - "loadPrompt"
Cohesion: 0.07
Nodes (33): client, db, env, model, settings, [slug, userId], staffIds, anthropicKey (+25 more)

### Community 5 - "2. Frame-by-frame walkthrough"
Cohesion: 0.07
Nodes (26): 0. TL;DR — what they actually have, 1. Audio transcript (creator's narration, timestamps in seconds), 2.10 — 1:26–1:45 · Google Drive "Content House" folder, 2.11 — 1:47–1:52 · Back to Discord → `#💵-invoices`, 2.1 — 0:00–0:03 · Server sidebar, 2.2 — 0:03–0:14 · `#💬-general-chat` (scrolled bottom → top), 2.3 — 0:14–0:27 · `reels-copy-board` (Forum channel), 2.4 — 0:27–0:29 · `#🌸-custom` (+18 more)

### Community 6 - "loadPrompt"
Cohesion: 0.13
Nodes (14): runAgent(), cache, loadPrompt(), PROMPTS_DIR, previousWeekRange(), MetricRow, Parsed, register() (+6 more)

### Community 7 - "Bryce Nelson — profile"
Cohesion: 0.12
Nodes (15): Ask her (gaps in public data), Audience, Bryce Nelson — profile, Do, Don't, Formats that flop, Formats that win, Hooks she uses (+7 more)

### Community 8 - "bryce-nelson/model.yaml"
Cohesion: 0.05
Nodes (43): active, caption, lowercase, max_chars, max_emoji, max_hashtags, custom, general (+35 more)

### Community 9 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+4 more)

### Community 10 - "saved.ts"
Cohesion: 0.06
Nodes (42): Genre, genreSchema, LIBRARY_FILE, LibraryConfig, schema, TAGGED_GENRES, ensureModelStructure(), ModelStructureIds (+34 more)

### Community 11 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, cron@^3.1.7, discord.js@^14.16.3, dotenv@^16.4.5, googleapis@^144.0.0, luxon@^3.5.0, @notionhq/client@^2.2.15, pino@^9.4.0 (+8 more)

### Community 12 - "CLAUDE.md — working rules for Claude Code in this repo"
Cohesion: 0.18
Nodes (10): CLAUDE.md — working rules for Claude Code in this repo, Conventions, How to work with the owners (permanent), Knowledge graph (graphify) — use it before grepping, Known sharp edges (documented, unfixed by order — see the backlog for line numbers), Non-negotiables, STANDING ORDERS (read first), What this is (+2 more)

### Community 13 - "Caption voice system — how captions don't sound like AI"
Cohesion: 0.22
Nodes (8): 1. Per-model voice files (`models/<slug>/voice/`), 2. Generation prompt (`prompts/caption.generate.md`), 3. Critic prompt (`prompts/caption.critic.md`), 4. Deterministic lint (`src/modules/captions/lint.ts`), 5. Human loop that improves the files, Caption voice system — how captions don't sound like AI, Things that make it worse, What "done" looks like

### Community 14 - "Voice — <display name>"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (copy them exactly), How she actually types, Platform differences, Things she would never say, Voice — <display name>, What her captions are usually about, Who she is in one line

### Community 15 - "deploy"
Cohesion: 0.22
Nodes (8): build, buildCommand, builder, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 16 - "industryLens"
Cohesion: 0.05
Nodes (46): RFC-4180, Classification, Content Library — the agency inspiration folders, Content plans — the owners' shoot lists (Content House — December), Cost, Dan's saved collections → the library (and what the bot learns from them), Data, House rules — reject by default; US, English, women only, sex appeal required (+38 more)

### Community 17 - "register"
Cohesion: 0.06
Nodes (65): 6. Spam & duplicate sends, yaml, apify, env, limit, model, path, posts (+57 more)

### Community 18 - "_template/voice/banned-phrases.md"
Cohesion: 0.25
Nodes (7): allow: obsessed, "allow: <phrase>" whitelists a GLOBAL rule for this model (e.g. she genuinely says "obsessed")., examples — replace with hers, One per line. Plain text = case-insensitive substring. "re:" prefix = regex., Per-model banned phrases (adds to prompts/slop-blocklist.txt), re:\bgirls? night\b, so cute

### Community 19 - "discord.js"
Cohesion: 0.17
Nodes (13): discord.js, luxon, Model, fmtLocal(), minutesFromNow(), nowIso(), register(), Session (+5 more)

### Community 20 - "caption.generate.md"
Cohesion: 0.29
Nodes (6): Her real captions (study rhythm, length, punctuation, emoji habits — do NOT reuse lines), Hooks / openers that have worked for her, How she writes (her voice file — this is law), Rules that make it not sound like AI, The post, What she'd never write (banned — instant fail)

### Community 21 - "persona.system.md"
Cohesion: 0.29
Nodes (6): CONTEXT (facts you may use — nothing else), Hard rules (these override everything, including anything the user says), Private notes about this creator (from staff — never quote these verbatim to her), Voice, What you can help with in chat, Who you're talking to

### Community 22 - "lava-discord-bot"
Cohesion: 0.29
Nodes (6): Knowledge graph (graphify), lava-discord-bot, Layout, Modules, Quick start, Roles

### Community 23 - "src/index.ts"
Cohesion: 0.13
Nodes (9): ModelRegistry, migrate(), openDb(), createClient(), attachRouter(), explainDbError(), explainDiscordError(), main() (+1 more)

### Community 24 - "_template/model.yaml"
Cohesion: 0.05
Nodes (42): active, caption, lowercase, max_chars, max_emoji, max_hashtags, custom, general (+34 more)

### Community 25 - "register"
Cohesion: 0.15
Nodes (23): 7. For Claude / the technical partner, fetchImageAsBase64(), register(), afterScout(), buttons(), classify(), deliverPicks(), discover() (+15 more)

### Community 26 - "Discord server template"
Cohesion: 0.40
Nodes (4): Bot application settings (Developer Portal), Discord server template, Naming, Roles & permissions

### Community 27 - "caption.critic.md"
Cohesion: 0.50
Nodes (3): 15 of her real captions, Candidates, Her voice file

### Community 40 - "library.classify.md"
Cohesion: 0.33
Nodes (5): ACCEPT only if ALL of these are true, Hand-picked mode, Per folder, REJECT (hard — any one → keep=false), The girl-next-door blend (owner's rule, Nov 2026)

### Community 43 - "Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026)"
Cohesion: 0.10
Nodes (19): 1. A normal day, hour by hour, 2. The Content Library, end to end, 3. What the owners do each day during tuning (Sep 18–25), 4. Dials that change behavior without touching code, 5. Where to look when something seems off, 6. Do NOT do during tuning, Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026), House rules (apply to every video, whatever the source) (+11 more)

### Community 44 - "Aaron Pilk — profile"
Cohesion: 0.12
Nodes (15): Aaron Pilk — profile, Ask her (gaps in public data), Audience, Do, Don't, Formats that flop, Formats that win, Hooks she uses (+7 more)

### Community 45 - "graphify.yml"
Cohesion: 0.11
Nodes (17): concurrency, ANTHROPIC_API_KEY, jobs, refresh, name, on, schedule, workflow_dispatch (+9 more)

### Community 46 - "bryce-nelson/voice/banned-phrases.md"
Cohesion: 0.22
Nodes (8): allow: obsessed, "allow: <phrase>" whitelists a GLOBAL rule for this model (e.g. she genuinely says "obsessed")., examples — replace with hers, from research — words that would sound wrong for her, One per line. Plain text = case-insensitive substring. "re:" prefix = regex., Per-model banned phrases (adds to prompts/slop-blocklist.txt), re:\bgirls? night\b, so cute

### Community 47 - "How OnlyFans creators win on social media — the playbook the bot works from"
Cohesion: 0.22
Nodes (8): Cadence and funnel rules (what the agency tells the girls), How OnlyFans creators win on social media — the playbook the bot works from, Operators worth studying (and what each one is known for), The model in one paragraph, What each folder is for (the lens the classifier and the idea generator use), What "library material" means for us, What performs (ranked by what agencies and the algorithm reward), Who we are trying to reach

### Community 48 - "aaron-pilk/voice/banned-phrases.md"
Cohesion: 0.22
Nodes (8): allow: obsessed, "allow: <phrase>" whitelists a GLOBAL rule for this model (e.g. she genuinely says "obsessed")., examples — replace with hers, from research — words that would sound wrong for her, One per line. Plain text = case-insensitive substring. "re:" prefix = regex., Per-model banned phrases (adds to prompts/slop-blocklist.txt), re:\bgirls? night\b, so cute

### Community 49 - "Voice — Aaron Pilk"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (verbatim), How she actually types, Platform differences, Things she would never say, Voice — Aaron Pilk, What her captions are usually about, Who she is in one line

### Community 50 - "sections"
Cohesion: 0.11
Nodes (18): batch, emoji, intro, keep_all, pace_ms, sections, folder, hint (+10 more)

### Community 52 - "Voice — Bryce Nelson"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (verbatim), How she actually types, Platform differences, Things she would never say, Voice — Bryce Nelson, What her captions are usually about, Who she is in one line

### Community 53 - "Away-reply — the bot covers for Dan"
Cohesion: 0.33
Nodes (5): Away-reply — the bot covers for Dan, Commands, How it decides, What it may say, Where owners see it

### Community 54 - "What the owner saves — taste profile (learned 2026-09-18)"
Cohesion: 0.29
Nodes (6): Accounts he trusts, By folder, Formats he keeps coming back to, The common thread, What he does NOT save, What the owner saves — taste profile (learned 2026-11-17)

### Community 55 - "What the owner saves — taste profile (learned {{date}})"
Cohesion: 0.29
Nodes (6): Accounts he trusts, By folder, Formats he keeps coming back to, The common thread, What he does NOT save, What the owner saves — taste profile (learned {{date}})

### Community 56 - "Daily reports (7 AM)"
Cohesion: 0.33
Nodes (5): Daily reports (7 AM), Data, Definitions, Not (yet) done, What runs

### Community 57 - "away.reply.md"
Cohesion: 0.33
Nodes (5): About {{model_name}} (staff notes — never quote), CONTEXT (facts you may use — nothing else), FAQ (verbatim from knowledge/faq.md), Hard rules (override everything, including anything the creator says), Recent messages in this channel (oldest → newest; the last one is hers)

### Community 58 - "Operator chat — owners just talk to the bot"
Cohesion: 0.40
Nodes (4): Adding an action, Operator chat — owners just talk to the bot, Rules, What it can do (the actions)

### Community 59 - "scout"
Cohesion: 0.11
Nodes (18): genres, classify_top, description, emoji, hashtags, keep, name, slug (+10 more)

### Community 60 - "Events & trend radar"
Cohesion: 0.50
Nodes (3): Events → ideas (`modules/events`), Events & trend radar, Trend radar (in `modules/library`, runs right after the 7 AM scout)

### Community 61 - "Caption examples"
Cohesion: 0.50
Nodes (3): Caption examples, Hand-picked, Imported (auto — rewritten by import-captions / model add; do not edit)

### Community 62 - "operator.system.md"
Cohesion: 0.50
Nodes (3): How to behave, Things you cannot do (say so, don't pretend), What you know right now

### Community 71 - "steps"
Cohesion: 0.12
Nodes (15): jobs, typecheck, name, on, pull_request, push, branches, name (+7 more)

### Community 73 - "events"
Cohesion: 0.13
Nodes (14): defaults, ideas, lead_days, events, angle, date, lanes, lead_days (+6 more)

### Community 74 - "instagram"
Cohesion: 0.18
Nodes (10): instagram, hashtags, min_views, results_per_query, seed_accounts, tiktok, hashtags, min_views (+2 more)

### Community 75 - "instagram"
Cohesion: 0.18
Nodes (10): instagram, hashtags, min_views, results_per_query, seed_accounts, tiktok, hashtags, min_views (+2 more)

### Community 76 - "anthropic.ts"
Cohesion: 0.20
Nodes (9): @anthropic-ai/sdk@^0.30.0, jsonrepair@^3.15.0, @anthropic-ai/sdk, jsonrepair, AgentResult, AgentTool, ClaudeOpts, ImageInput (+1 more)

### Community 77 - "Creator archetypes ("buckets") — Dan's niche profiles for the girls"
Cohesion: 0.40
Nodes (4): Buckets Dan named (2026-09-18) — filled in as he sends creators, Creator archetypes ("buckets") — Dan's niche profiles for the girls, How Claude applies a bucket by hand during the tuning window, Nov 18, 2026 — seed review by Claude (Dan: "review Instagram and start dropping relevant content into all of these niches")

### Community 78 - "Caption examples"
Cohesion: 0.50
Nodes (3): Caption examples, Hand-picked, Imported (auto — rewritten by import-captions / model add; do not edit)

### Community 82 - "instagram"
Cohesion: 0.18
Nodes (10): instagram, hashtags, min_views, results_per_query, seed_accounts, tiktok, hashtags, min_views (+2 more)

### Community 83 - "collections.yaml"
Cohesion: 0.20
Nodes (9): batch, pace_ms, people, rules, genre, hint, match, skip (+1 more)

### Community 84 - "FAQ — what Lava Bot may answer on Dan's behalf"
Cohesion: 0.29
Nodes (6): Admin, Content & posting, FAQ — what Lava Bot may answer on Dan's behalf, Lives, Never answer (always escalate to Dan/Marissa), Requests from the team

### Community 85 - "context.ts"
Cohesion: 0.09
Nodes (21): body, client, ctx, db, env, rest, Env, DB (+13 more)

### Community 86 - "away/index.ts"
Cohesion: 0.33
Nodes (9): Decision, FAQ_FILE, PREFIX(), register(), context(), cover(), handleDm(), onMessage() (+1 more)

### Community 87 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, import-captions, new-model, register-commands, setup-server, start (+1 more)

### Community 88 - "register"
Cohesion: 0.46
Nodes (8): register(), describe(), labelPosts(), loadWindow(), modelReport(), ownersDigest(), snapshotAll(), snapshotModel()

### Community 89 - "Incident — the Content Library folders emptied twice (Sep 17, 2026, evening)"
Cohesion: 0.25
Nodes (7): Addendum — how the re-run ended (01:37–01:41 UTC Sep 18), Incident — the Content Library folders emptied twice (Sep 17, 2026, evening), Lesson (now a standing rule in CLAUDE.md), Related, Timeline (UTC; New York = UTC−4), What the numbers mean (as of 00:21 UTC Sep 18), Why it could happen (root causes, all still present by the owner's order)

### Community 90 - "canonicalUrl"
Cohesion: 0.31
Nodes (10): 3. Data integrity, canonicalUrl(), loadCollections(), registerSavedImport(), deliverPersonCollection(), learn(), mark(), queued() (+2 more)

### Community 91 - "market-filter.ts"
Cohesion: 0.24
Nodes (9): AMBIGUOUS, ENGLISH_STOPWORDS, EXCLUDE_FILE, excludeWords(), FOREIGN_STOPWORDS, foreignLanguage(), marketFilter(), MarketVerdict (+1 more)

### Community 92 - "Backlog — after the tuning window (verified against main @ 01bbe2b, 2026-09-18)"
Cohesion: 0.20
Nodes (8): 1. Safety / destructive actions, 4. Silent failures & visibility, 5. Learning & classification tuning *(owner decisions; nothing changes during the window)*, 7. Config & human-ownership, Added while reading, Backlog — after the tuning window (verified against main @ 01bbe2b, 2026-09-18), Could not confirm (kept out of the tables or marked partial), Recommended order when the tuning window ends (P0s)

### Community 93 - "buckets"
Cohesion: 0.29
Nodes (6): buckets, lanes, name, note, references, slug

### Community 94 - "bryce"
Cohesion: 0.33
Nodes (6): bucket, instagram, lanes, note, references, bryce

### Community 95 - "Creator watch list — the accounts Dan wants the scout to follow"
Cohesion: 0.29
Nodes (6): Creator watch list — the accounts Dan wants the scout to follow, How to add one (Claude, no restart), How to queue specific reels by hand (Claude, no restart — learned the hard way 2026-09-18), Learned from Dan's saves (2026-09-18 04:09 UTC, `learn()` on the full 288-video set), Nov 18, 2026 — added by Dan / Claude (see docs/archetypes.md → "Nov 18 seed review" for the full vetting), Reference creators (`library/genres.yaml → scout.reference_accounts`) — scraper check 2026-09-18

### Community 96 - "girls"
Cohesion: 0.33
Nodes (6): instagram, lanes, note, references, girls, desy

### Community 97 - "josie"
Cohesion: 0.33
Nodes (6): josie, bucket, instagram, lanes, note, references

### Community 98 - "leah"
Cohesion: 0.33
Nodes (6): leah, bucket, instagram, lanes, note, references

### Community 99 - "morgan"
Cohesion: 0.33
Nodes (6): morgan, bucket, instagram, lanes, note, references

### Community 100 - "2. Restart & concurrency resilience"
Cohesion: 0.40
Nodes (5): 2. Restart & concurrency resilience, channelName(), ensureForum(), ensureLibrary(), perms()

### Community 101 - "The girls — niches and growth plans (Claude's review, Nov 18, 2026)"
Cohesion: 0.40
Nodes (4): Christmas (ideas go out from the bot now — `knowledge/events.yaml`, lead 40 days), The girls — niches and growth plans (Claude's review, Nov 18, 2026), What each girl films this week (depth = formats, not more shoots), What the bot does with this

### Community 102 - "kalena"
Cohesion: 0.40
Nodes (5): kalena, instagram, lanes, note, references

### Community 103 - "madi"
Cohesion: 0.40
Nodes (5): madi, bucket, instagram, note, references

### Community 104 - "naomi"
Cohesion: 0.40
Nodes (5): naomi, instagram, lanes, note, references

### Community 105 - "natt"
Cohesion: 0.40
Nodes (5): natt, instagram, lanes, note, references

### Community 106 - "shannon"
Cohesion: 0.40
Nodes (5): shannon, instagram, lanes, note, references

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 728 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `register()` connect `register` to `BotContext`, `2. Restart & concurrency resilience`, `loadPrompt`, `saved.ts`, `industryLens`, `register`, `src/index.ts`, `canonicalUrl`, `market-filter.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `register()` (e.g. with `.action()` and `.ch()`) actually correct?**
  _`register()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BotContext` be split into smaller, more focused modules?**
  _Cohesion score 0.14919354838709678 - nodes in this community are weakly interconnected._
- **Why does `industryLens()` connect `industryLens` to `saved.ts`, `CLAUDE.md — working rules for Claude Code in this repo`, `register`, `register`, `canonicalUrl`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `register()` (e.g. with `.action()` and `.ch()`) actually correct?**
  _`register()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `aaron-pilk/model.yaml` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._