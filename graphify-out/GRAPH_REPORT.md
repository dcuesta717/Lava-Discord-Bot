# Graph Report - lava-discord-bot  (2026-09-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 478 nodes · 875 edges · 43 communities (25 shown, 18 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5f4cdcab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37

## God Nodes (most connected - your core abstractions)
1. `BotContext` - 30 edges
2. `register()` - 27 edges
3. `main()` - 21 edges
4. `discord.js` - 18 edges
5. `loadPrompt()` - 18 edges
6. `Model` - 14 edges
7. `register()` - 14 edges
8. `Apify` - 13 edges
9. `Settings` - 13 edges
10. `Timers` - 13 edges

## Surprising Connections (you probably didn't know these)
- `5. Still open (everything else is decided — see §4.0)` --references--> `normalize()`  [INFERRED]
  docs/source-analysis/Nivo-Discord-Bot-Analysis.md → src/integrations/apify.ts
- `Request flows` --references--> `generateCaption()`  [INFERRED]
  docs/architecture.md → src/modules/captions/generate.ts
- `Build order (each is a day or less)` --references--> `normalize()`  [INFERRED]
  docs/architecture.md → src/integrations/apify.ts
- `Adding integrations` --references--> `normalize()`  [INFERRED]
  docs/runbook.md → src/integrations/apify.ts
- `Gotchas` --references--> `threadForCategory()`  [INFERRED]
  docs/runbook.md → src/modules/reels/index.ts

## Import Cycles
- None detected.

## Communities (43 total, 18 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (34): Gotchas, discord.js, luxon, body, client, ctx, db, env (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (42): dependencies, @anthropic-ai/sdk, apify-client, cron, discord.js, dotenv, googleapis, luxon (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (32): yaml, Genre, genreSchema, LIBRARY_FILE, LibraryConfig, loadLibrary(), schema, canonicalUrl() (+24 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (27): Architecture, Build order (each is a day or less), Deliberate non-goals, Request flows, Adding integrations, Daily ops for Dan/Marissa, Deploy, First run (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (30): ref_node_fs, ref_node_path, dst, [slug, displayName, code], src, yaml, yamlPath, channels (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): 0. TL;DR — what they actually have, 1. Audio transcript (creator's narration, timestamps in seconds), 2.10 — 1:26–1:45 · Google Drive "Content House" folder, 2.11 — 1:47–1:52 · Back to Discord → `#💵-invoices`, 2.1 — 0:00–0:03 · Server sidebar, 2.2 — 0:03–0:14 · `#💬-general-chat` (scrolled bottom → top), 2.3 — 0:14–0:27 · `reels-copy-board` (Forum channel), 2.4 — 0:27–0:29 · `#🌸-custom` (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): ref_dotenv_config, zod, client, db, env, ids, model, overwrites (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (13): googleapis, ref_node_events, @notionhq/client, pino, logEvent(), CommandBuilder, CommandHandler, ComponentHandler (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (8): migrate(), MIGRATIONS_DIR, openDb(), createClient(), attachRouter(), explainDbError(), explainDiscordError(), main()

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (5): @anthropic-ai/sdk, Claude, ClaudeOpts, ImageInput, parseJson()

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (3): Env, DB, Settings

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (4): Zernio, ZernioAccount, ZernioCreatePost, ZernioPlatformTarget

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): 1. Per-model voice files (`models/<slug>/voice/`), 2. Generation prompt (`prompts/caption.generate.md`), 3. Critic prompt (`prompts/caption.critic.md`), 4. Deterministic lint (`src/modules/captions/lint.ts`), 5. Human loop that improves the files, Caption voice system — how captions don't sound like AI, Things that make it worse, What "done" looks like

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): 3 captions someone wrote for her that she HATED (so we know the failure mode), 5 captions of hers that are PERFECT examples of her voice (copy them exactly), How she actually types, Platform differences, Things she would never say, Voice — <display name>, What her captions are usually about, Who she is in one line

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (8): build, buildCommand, builder, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): CLAUDE.md — working rules for Claude Code in this repo, Conventions, Knowledge graph, Non-negotiables, What this is, When adding a model, Where things are

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (7): Classification, Content Library — the agency inspiration folders, Cost, Data, Not (yet) done, Two ways in, What a post looks like

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (7): allow: obsessed, "allow: <phrase>" whitelists a GLOBAL rule for this model (e.g. she genuinely says "obsessed")., examples — replace with hers, One per line. Plain text = case-insensitive substring. "re:" prefix = regex., Per-model banned phrases (adds to prompts/slop-blocklist.txt), re:\bgirls? night\b, so cute

### Community 19 - "Community 19"
Cohesion: 0.38
Nodes (3): Notion schema (optional mirror), Integrations, Notion

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (6): Her real captions (study rhythm, length, punctuation, emoji habits — do NOT reuse lines), Hooks / openers that have worked for her, How she writes (her voice file — this is law), Rules that make it not sound like AI, The post, What she'd never write (banned — instant fail)

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (6): CONTEXT (facts you may use — nothing else), Hard rules (these override everything, including anything the user says), Private notes about this creator (from staff — never quote these verbatim to her), Voice, What you can help with in chat, Who you're talking to

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (6): Knowledge graph (optional but recommended), lava-discord-bot, Layout, Modules, Quick start, Roles

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (4): Bot application settings (Developer Portal), Discord server template, Naming, Roles & permissions

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (3): 15 of her real captions, Candidates, Her voice file

## Knowledge Gaps
- **216 isolated node(s):** `name`, `version`, `private`, `type`, `node` (+211 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 276 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalize()` connect `Community 3` to `Community 5`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `5. Still open (everything else is decided — see §4.0)` connect `Community 5` to `Community 3`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `register()` (e.g. with `.command()` and `.component()`) actually correct?**
  _`register()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `main()` (e.g. with `.all()` and `.start()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _216 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09273182957393483 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._