# Graph Report - Lava-Discord-Bot  (2026-10-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 849 nodes · 1599 edges · 86 communities (60 shown, 26 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 164 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ecfc5f42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BotContext
- package.json
- register
- Apify
- models.ts
- 2. Frame-by-frame walkthrough
- env.ts
- Bryce Nelson — profile
- CLAUDE.md — working rules for Claude Code in this repo
- compilerOptions
- saved.ts
- setup-server.ts
- Zernio
- Caption voice system — how captions don't sound like AI
- Voice — <display name>
- deploy
- events/index.ts
- register
- _template/voice/banned-phrases.md
- context.ts
- caption.generate.md
- persona.system.md
- lava-discord-bot
- src/index.ts
- market-filter.ts
- registerSavedImport
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
- canonicalUrl
- bryce-nelson/voice/banned-phrases.md
- How OnlyFans creators win on social media — the playbook the bot works from
- aaron-pilk/voice/banned-phrases.md
- Voice — Aaron Pilk
- register-commands.ts
- anthropic.ts
- Voice — Bryce Nelson
- Away-reply — the bot covers for Dan
- What the owner saves — taste profile (learned 2026-09-18)
- What the owner saves — taste profile (learned {{date}})
- Daily reports (7 AM)
- away.reply.md
- Operator chat — owners just talk to the bot
- Incident — the Content Library folders emptied twice (Sep 17, 2026, evening)
- Events & trend radar
- Caption examples
- operator.system.md
- Staff notes — Aaron Pilk (private — fed to the persona as background, never quoted to her)
- aaron-pilk/playbooks/README.md
- aaron-pilk/voice/hooks.md
- Creator watch list — the accounts Dan wants the scout to follow
- Drive
- prompts.ts
- ModelRegistry
- discord.js
- Timers
- Creator archetypes ("buckets") — Dan's niche profiles for the girls
- Caption examples
- Staff notes — Bryce Nelson (private — fed to the persona as background, never quoted to her)
- bryce-nelson/playbooks/README.md
- bryce-nelson/voice/hooks.md
- Content Library — the agency inspiration folders
- library/index.ts
- FAQ — what Lava Bot may answer on Dan's behalf
- new-model.ts

## God Nodes (most connected - your core abstractions)
1. `register()` - 41 edges
2. `register()` - 40 edges
3. `BotContext` - 38 edges
4. `loadPrompt()` - 36 edges
5. `discord.js` - 25 edges
6. `main()` - 23 edges
7. `Model` - 19 edges
8. `register()` - 19 edges
9. `canonicalUrl()` - 19 edges
10. `register()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `House rules — reject by default; US, English, women only, sex appeal required` --references--> `classify()`  [INFERRED]
  docs/content-library.md → src/modules/library/index.ts
- `Known sharp edges (documented, unfixed by order — see the backlog for line numbers)` --references--> `learn()`  [INFERRED]
  CLAUDE.md → src/modules/library/saved.ts
- `Learned from Dan's saves (2026-09-18 04:09 UTC, `learn()` on the full 288-video set)` --references--> `learn()`  [INFERRED]
  docs/creator-list.md → src/modules/library/saved.ts
- `Addendum — how the re-run ended (01:37–01:41 UTC Sep 18)` --references--> `learn()`  [INFERRED]
  docs/incidents/2026-09-17-library-wipe.md → src/modules/library/saved.ts
- `Things to watch (noticed while writing this; nothing was changed)` --references--> `queued()`  [INFERRED]
  docs/daily-operations.md → src/modules/library/saved.ts

## Import Cycles
- None detected.

## Communities (86 total, 26 thin omitted)

### Community 0 - "BotContext"
Cohesion: 0.08
Nodes (38): 6. Spam & duplicate sends, BotContext, fetchImageAsBase64(), loadPrompt(), fmtLocal(), minutesFromNow(), nowIso(), previousWeekRange() (+30 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (42): dependencies, @anthropic-ai/sdk, apify-client, cron, discord.js, dotenv, googleapis, jsonrepair (+34 more)

### Community 2 - "register"
Cohesion: 0.20
Nodes (15): register(), buttons(), channelName(), download(), engagement(), ensureLibrary(), exists(), ingest() (+7 more)

### Community 3 - "Apify"
Cohesion: 0.09
Nodes (17): Architecture, Build order (each is a day or less), Deliberate non-goals, Request flows, Adding integrations, Daily ops for Dan/Marissa, Deploy, First run (+9 more)

### Community 4 - "models.ts"
Cohesion: 0.14
Nodes (21): channels, loadModels(), Model, ModelConfig, ModelFiles, MODELS_DIR, modelSchema, readIf() (+13 more)

### Community 5 - "2. Frame-by-frame walkthrough"
Cohesion: 0.07
Nodes (26): 0. TL;DR — what they actually have, 1. Audio transcript (creator's narration, timestamps in seconds), 2.10 — 1:26–1:45 · Google Drive "Content House" folder, 2.11 — 1:47–1:52 · Back to Discord → `#💵-invoices`, 2.1 — 0:00–0:03 · Server sidebar, 2.2 — 0:03–0:14 · `#💬-general-chat` (scrolled bottom → top), 2.3 — 0:14–0:27 · `reels-copy-board` (Forum channel), 2.4 — 0:27–0:29 · `#🌸-custom` (+18 more)

### Community 6 - "env.ts"
Cohesion: 0.25
Nodes (7): dotenv, zod, anthropicKey, csv, discordToken, postgresUrl, schema

### Community 7 - "Bryce Nelson — profile"
Cohesion: 0.12
Nodes (15): Ask her (gaps in public data), Audience, Bryce Nelson — profile, Do, Don't, Formats that flop, Formats that win, Hooks she uses (+7 more)

### Community 8 - "CLAUDE.md — working rules for Claude Code in this repo"
Cohesion: 0.18
Nodes (10): CLAUDE.md — working rules for Claude Code in this repo, Conventions, How to work with the owners (permanent), Knowledge graph (graphify) — use it before grepping, Known sharp edges (documented, unfixed by order — see the backlog for line numbers), Non-negotiables, STANDING ORDERS — tuning window Sep 18 → Sep 25, 2026 (read first), What this is (+2 more)

### Community 9 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+4 more)

### Community 10 - "saved.ts"
Cohesion: 0.13
Nodes (14): RFC-4180, IngestOpts, IngestResult, ItemRow, CollectionsConfig, FILE, loadCollections(), parseCsv() (+6 more)

### Community 11 - "setup-server.ts"
Cohesion: 0.12
Nodes (12): postgres, client, db, env, model, settings, [slug, userId], staffIds (+4 more)

### Community 12 - "Zernio"
Cohesion: 0.22
Nodes (4): Zernio, ZernioAccount, ZernioCreatePost, ZernioPlatformTarget

### Community 13 - "Caption voice system — how captions don't sound like AI"
Cohesion: 0.22
Nodes (8): 1. Per-model voice files (`models/<slug>/voice/`), 2. Generation prompt (`prompts/caption.generate.md`), 3. Critic prompt (`prompts/caption.critic.md`), 4. Deterministic lint (`src/modules/captions/lint.ts`), 5. Human loop that improves the files, Caption voice system — how captions don't sound like AI, Things that make it worse, What "done" looks like

### Community 14 - "Voice — <display name>"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (copy them exactly), How she actually types, Platform differences, Things she would never say, Voice — <display name>, What her captions are usually about, Who she is in one line

### Community 15 - "deploy"
Cohesion: 0.22
Nodes (8): build, buildCommand, builder, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 16 - "events/index.ts"
Cohesion: 0.17
Nodes (18): luxon, EventDef, EVENTS_FILE, eventSchema, EventsConfig, loadEvents(), nextOccurrence(), nthWeekday() (+10 more)

### Community 17 - "register"
Cohesion: 0.08
Nodes (48): Slash commands you will use, yaml, apify, env, limit, model, path, posts (+40 more)

### Community 18 - "_template/voice/banned-phrases.md"
Cohesion: 0.25
Nodes (7): allow: obsessed, "allow: <phrase>" whitelists a GLOBAL rule for this model (e.g. she genuinely says "obsessed")., examples — replace with hers, One per line. Plain text = case-insensitive substring. "re:" prefix = regex., Per-model banned phrases (adds to prompts/slop-blocklist.txt), re:\bgirls? night\b, so cute

### Community 19 - "context.ts"
Cohesion: 0.16
Nodes (8): Notion schema (optional mirror), Action, CommandBuilder, CommandHandler, ComponentHandler, Integrations, ModalHandler, Notion

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
Cohesion: 0.35
Nodes (8): loadEnv(), migrate(), openDb(), createClient(), attachRouter(), explainDbError(), explainDiscordError(), main()

### Community 24 - "market-filter.ts"
Cohesion: 0.24
Nodes (9): AMBIGUOUS, ENGLISH_STOPWORDS, EXCLUDE_FILE, excludeWords(), FOREIGN_STOPWORDS, foreignLanguage(), marketFilter(), MarketVerdict (+1 more)

### Community 25 - "registerSavedImport"
Cohesion: 0.17
Nodes (21): 2. Restart & concurrency resilience, 3. Data integrity, 4. Silent failures & visibility, 5. Learning & classification tuning *(owner decisions; nothing changes during the window)*, 7. Config & human-ownership, Added while reading, Backlog — after the tuning window (verified against main @ 01bbe2b, 2026-09-18), Could not confirm (kept out of the tables or marked partial) (+13 more)

### Community 26 - "Discord server template"
Cohesion: 0.40
Nodes (4): Bot application settings (Developer Portal), Discord server template, Naming, Roles & permissions

### Community 27 - "caption.critic.md"
Cohesion: 0.50
Nodes (3): 15 of her real captions, Candidates, Her voice file

### Community 40 - "library.classify.md"
Cohesion: 0.50
Nodes (3): ACCEPT only if ALL of these are true, Per folder, REJECT (hard — any one → keep=false)

### Community 43 - "Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026)"
Cohesion: 0.11
Nodes (18): 1. A normal day, hour by hour, 2. The Content Library, end to end, 3. What the owners do each day during tuning (Sep 18–25), 4. Dials that change behavior without touching code, 5. Where to look when something seems off, 6. Do NOT do during tuning, Daily operations — what the bot does and what the owners do (tuning week Sep 18–25, 2026), House rules (apply to every video, whatever the source) (+10 more)

### Community 44 - "Aaron Pilk — profile"
Cohesion: 0.12
Nodes (15): Aaron Pilk — profile, Ask her (gaps in public data), Audience, Do, Don't, Formats that flop, Formats that win, Hooks she uses (+7 more)

### Community 45 - "canonicalUrl"
Cohesion: 0.25
Nodes (14): loadLibrary(), canonicalUrl(), setLanes(), chunk(), PostRow, register(), describe(), labelPosts() (+6 more)

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

### Community 50 - "register-commands.ts"
Cohesion: 0.20
Nodes (7): body, client, ctx, db, env, rest, register()

### Community 51 - "anthropic.ts"
Cohesion: 0.14
Nodes (9): @anthropic-ai/sdk, jsonrepair, AgentResult, AgentTool, Claude, ClaudeOpts, ImageInput, parseJson() (+1 more)

### Community 52 - "Voice — Bryce Nelson"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (verbatim), How she actually types, Platform differences, Things she would never say, Voice — Bryce Nelson, What her captions are usually about, Who she is in one line

### Community 53 - "Away-reply — the bot covers for Dan"
Cohesion: 0.33
Nodes (5): Away-reply — the bot covers for Dan, Commands, How it decides, What it may say, Where owners see it

### Community 54 - "What the owner saves — taste profile (learned 2026-09-18)"
Cohesion: 0.29
Nodes (6): Accounts he trusts, By folder, Formats he keeps coming back to, The common thread, What he does NOT save, What the owner saves — taste profile (learned 2026-09-18)

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

### Community 59 - "Incident — the Content Library folders emptied twice (Sep 17, 2026, evening)"
Cohesion: 0.17
Nodes (10): 1. Safety / destructive actions, Addendum — how the re-run ended (01:37–01:41 UTC Sep 18), Incident — the Content Library folders emptied twice (Sep 17, 2026, evening), Lesson (now a standing rule in CLAUDE.md), Related, Timeline (UTC; New York = UTC−4), What the numbers mean (as of 00:21 UTC Sep 18), Why it could happen (root causes, all still present by the owner's order) (+2 more)

### Community 60 - "Events & trend radar"
Cohesion: 0.50
Nodes (3): Events → ideas (`modules/events`), Events & trend radar, Trend radar (in `modules/library`, runs right after the 7 AM scout)

### Community 61 - "Caption examples"
Cohesion: 0.50
Nodes (3): Caption examples, Hand-picked, Imported (auto — rewritten by import-captions / model add; do not edit)

### Community 62 - "operator.system.md"
Cohesion: 0.50
Nodes (3): How to behave, Things you cannot do (say so, don't pretend), What you know right now

### Community 71 - "Creator watch list — the accounts Dan wants the scout to follow"
Cohesion: 0.33
Nodes (5): Creator watch list — the accounts Dan wants the scout to follow, How to add one (Claude, no restart), How to queue specific reels by hand (Claude, no restart — learned the hard way 2026-09-18), Learned from Dan's saves (2026-09-18 04:09 UTC, `learn()` on the full 288-video set), Reference creators (`library/genres.yaml → scout.reference_accounts`) — scraper check 2026-09-18

### Community 72 - "Drive"
Cohesion: 0.14
Nodes (6): googleapis, @notionhq/client, pino, Drive, log, Logger

### Community 73 - "prompts.ts"
Cohesion: 0.17
Nodes (10): Dan's saved collections → the library (and what the bot learns from them), INDUSTRY, industryLens(), read(), TASTE, cache, PROMPTS_DIR, Decision (+2 more)

### Community 75 - "discord.js"
Cohesion: 0.35
Nodes (8): discord.js, ensureModelStructure(), ModelStructureIds, clampToBot(), MEMBER, ROLE, AGENCY, STAFF

### Community 76 - "Timers"
Cohesion: 0.22
Nodes (3): TimerHandler, TimerRow, Timers

### Community 77 - "Creator archetypes ("buckets") — Dan's niche profiles for the girls"
Cohesion: 0.50
Nodes (3): Buckets Dan named (2026-09-18) — filled in as he sends creators, Creator archetypes ("buckets") — Dan's niche profiles for the girls, How Claude applies a bucket by hand during the tuning window

### Community 78 - "Caption examples"
Cohesion: 0.50
Nodes (3): Caption examples, Hand-picked, Imported (auto — rewritten by import-captions / model add; do not edit)

### Community 82 - "Content Library — the agency inspiration folders"
Cohesion: 0.22
Nodes (8): Classification, Content Library — the agency inspiration folders, Cost, Data, House rules — reject by default; US, English, women only, sex appeal required, Not (yet) done, Two ways in, What a post looks like

### Community 83 - "library/index.ts"
Cohesion: 0.32
Nodes (6): Genre, genreSchema, LIBRARY_FILE, LibraryConfig, schema, Classified

### Community 84 - "FAQ — what Lava Bot may answer on Dan's behalf"
Cohesion: 0.29
Nodes (6): Admin, Content & posting, FAQ — what Lava Bot may answer on Dan's behalf, Lives, Never answer (always escalate to Dan/Marissa), Requests from the team

### Community 85 - "new-model.ts"
Cohesion: 0.33
Nodes (5): dst, [slug, displayName, code], src, yaml, yamlPath

## Knowledge Gaps
- **6 isolated node(s):** `pino-pretty`, `tsx`, `@types/luxon`, `@types/node`, `typescript` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 468 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalize()` connect `Apify` to `2. Frame-by-frame walkthrough`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `register()` (e.g. with `.action()` and `.ch()`) actually correct?**
  _`register()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `pino-pretty`, `tsx`, `@types/luxon` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BotContext` be split into smaller, more focused modules?**
  _Cohesion score 0.07788461538461539 - nodes in this community are weakly interconnected._
- **Why does `register()` connect `register` to `BotContext`, `prompts.ts`, `discord.js`, `canonicalUrl`, `library/index.ts`, `src/index.ts`, `market-filter.ts`, `registerSavedImport`, `Incident — the Content Library folders emptied twice (Sep 17, 2026, evening)`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `register()` (e.g. with `.action()` and `.ch()`) actually correct?**
  _`register()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._