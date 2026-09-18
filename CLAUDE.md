# CLAUDE.md — working rules for Claude Code in this repo

## What this is
A single Discord bot for an OnlyFans/creator management agency (Lava Mgmt). ~15 models, each with a private Discord category and a folder under `models/<slug>/`. The bot relays work between owners (Dan, Marissa) and models, tracks lives, parses weekly IG stats, sources reels to recreate, writes captions in each model's voice, and auto-posts via Zernio after human approval. Reference implementation we are cloning: `docs/source-analysis/Nivo-Discord-Bot-Analysis.md`.

## STANDING ORDERS — tuning window Sep 18 → Sep 25, 2026 (read first)
Set by Dan on Sep 18 after the library wipe (`docs/incidents/2026-09-17-library-wipe.md`). They override everything below until he says "go".
- **No code changes. No protocol changes. No prompt/yaml/txt changes.** Not even fixes for the findings in `docs/backlog-post-tuning.md`, and explicitly **no "never delete" safeguard yet**. The owners are testing the system as it is, over and over, for seven days; the job is to learn what they want executed daily and get it exactly right *before* changing anything.
- **Docs are the only thing that may change** (`docs/`, `README.md`, `CLAUDE.md`, `graphify-out/`, `.github/`) — those paths do not redeploy (Railway watch patterns: `**`, `!/graphify-out/**`, `!/docs/**`, `!/README.md`, `!/CLAUDE.md`, `!/.github/**`, verified Sep 18). Anything else — including `knowledge/`, `library/`, `models/`, `prompts/` — restarts the bot and kills whatever it is doing.
- **Announce before anything destructive, then wait for a yes.** Deleting posts, clearing folders, purging an origin, re-running a whole import, removing channels, replacing a girl's files: say in chat, in plain words, what will disappear, how many, why, and that the links survive. Even when the owner asked for the change that makes it necessary. If nobody is around, do the non-destructive part and stop. (This is the lesson of Sep 17: the plan was fine, the silence was not.)
- **Never deploy or restart while an import is running** without saying so first. `/library import status:true` → "⏸ not running" is the green light. Bot-made commits (`knowledge/taste.md`, `models/*`) restart it too.
- **When the window ends:** the owner picks from `docs/backlog-post-tuning.md` (P0s first: confirm buttons + archive-not-delete, retry for `failed`, persisted import scope, stop bot commits from redeploying). Also decided, not open: remove the five dress-code terms from `library/market-exclude.txt` (backlog AG).

## How to work with the owners (permanent)
- Dan (head owner) and Marissa are not technical and never open GitHub, files or a database. Discord *is* the system to them; Aaron is the technical partner. **Owner-facing text never mentions GitHub, files, repos, commits, deploys or Railway** — say "the bot's memory", "a restart (~2 min)", "the folders".
- Explain what happened, not what the code did. When something goes wrong, the first message is: what they saw, whether anything is lost, what is being done, what is needed from them.
- **Secrets are never read, typed or stored** by Claude (bot token, Anthropic key, DB URL, Apify token, GitHub PAT). Dan pastes them into Railway himself.
- Never send Discord messages as Dan. Never hammer Instagram (paced scraping only; Apify for fetching). Only the saved collections Dan named go into the import.
- Content rules Dan set (already in `prompts/library.classify.md`, `knowledge/industry.md`, `src/lib/market-filter.ts`): reject by default; made in the United States; English caption **and** on-screen text; women only on camera; sex appeal required in every folder. **The bot filters by country, language and on-camera gender only. It does not and will not filter creators by race or religion** — Claude told Dan so on Sep 17 and holds that line.
- Still waiting on Dan (as of Sep 18): the list of girls to focus on; whether the two "Owen Lynch" collections should be studied for formats (skipped today by the no-men rule); which folder his "content" collection meant.
- Plain-English runbook for the owners: `docs/daily-operations.md` (what happens each day, what they check, how to word feedback so it maps to one file edit).

## Non-negotiables
1. **Prompts live in `prompts/*.md`, never as string literals in `src/`.** Load them with `loadPrompt('caption.generate')`.
2. **Per-model anything lives in `models/<slug>/`.** Never hard-code a model's name, ids, handles or voice in code. Code reads `model.yaml` + `voice/*`. Agency-wide genre folders live in `library/genres.yaml` the same way.
3. **Every bot action that changes state writes a row in Postgres (Supabase project `lava-discord-bot`, schema `bot`) and (if configured) a Notion row.** Discord is the UI, not the database. All queries go through the `postgres` tagged template on `ctx.db`; new tables = a new numbered file in `src/db/migrations/` (applied automatically at boot).
4. **Timers must be durable.** Anything scheduled (live check-ins, reminders, scheduled posts) is stored in `db` and re-armed on boot. Never rely on in-memory `setTimeout` alone.
5. **Nothing auto-posts without a human button press.** Captions and posts always go through an approval card (`modules/posting/index.ts`, `modules/captions/index.ts`).
6. **Persona guardrails** (`prompts/persona.system.md`) are appended to every model-facing generation: no pet names, no comments on bodies/weight, no sexual talk toward the model, never invent numbers.
7. **Captions must pass `modules/captions/lint.ts`** (global + per-model banned phrases, emoji/hashtag budgets, length) before they are shown to anyone.
8. **Secrets only via `.env`.** Never commit tokens. `.env.example` lists every variable.

## Conventions
- TypeScript, ESM, Node 20. `npm run typecheck` must pass before commit.
- One module = one folder under `src/modules/<name>/` with `index.ts` exporting `register(ctx: BotContext)`. Modules register commands, component handlers and crons through the context; they never import each other directly — use `ctx.bus` events.
- Slash commands are registered on boot from each module's `ctx.command(...)`. Anything an owner might ask for in chat is ALSO registered as `ctx.action(name, {...})` (JSON-schema input + `run`) — the operator module turns every action into a Claude tool. New capability = command + action, sharing one function.
- Component custom ids follow `module:action:modelSlug:entityId` (e.g. `reels:on_drive:jane:123`).
- Model timezone (`model.yaml → timezone`) governs every cron for that model.
- Logs: `ctx.log.info({ model, module }, 'message')` (pino). Also mirror important actions to the `#ops-log` channel via `ctx.ops()`.

## Where things are
- Boot & wiring → `src/index.ts`, `src/discord/client.ts`
- Model config loader → `src/config/models.ts` (validates with zod)
- All ten modules are implemented → `src/modules/<name>/index.ts`; each one's header comment is the spec.
- Content Library (agency-wide genre folders) → `src/modules/library/index.ts`, genres in `library/genres.yaml`, spec in `docs/content-library.md`. Adding a genre = a yaml entry, never code.
- Market fit: `src/lib/market-filter.ts` (non-Latin script + `library/market-exclude.txt`) drops off-market scout candidates before Claude; `knowledge/industry.md` is the agency's playbook (what works for OF creators on IG/TikTok, what "library material" means, operators to study) and is injected as `{{industry}}` via `src/lib/industry.ts`. Content rules change there, not in prompts.
- Dan's saved collections → `src/modules/library/saved.ts`: Google Sheet (`library/collections.yaml`) → `bot.saved_imports` queue → Apify → classify with the collection as hint → library; then learning: repeat authors → `bot.library_sources`, `prompts/library.taste.md` → `knowledge/taste.md` (injected by `industryLens()`), per-girl collections → her board on `model:live`. `/library import`, actions `import_saved_collections`, `saved_import_status`, `relearn_from_library`.
- Not yet wired (see README): Drive ready-to-post automation, Zernio status polling, OF earnings source.
- Operations & history → `docs/daily-operations.md` (owner runbook, every schedule with file:line, dials, "things to watch"), `docs/backlog-post-tuning.md` (audit findings A–Z + AA–AI, verified, rated, proposed fixes — **not implemented**), `docs/incidents/` (what went wrong and the lesson).

## Known sharp edges (documented, unfixed by order — see the backlog for line numbers)
Purges and boot jobs delete first and announce after; chat actions `purge_library` / `remove_model` / `remove_owner` have no confirm button; `failed` import rows are terminal; a scoped `/library import collection:X` becomes a full import after the restart that `learn()`'s taste.md commit causes; deployments overlap for a few seconds (two processes can run one queue); `keep=false` with `genre:null` counts as failed; the saved-import hint ("keep it unless unusable") pulls against the reject-by-default prompt; `min_score` applies to the scout only; 🔥/👎 moves seed weights on every press; the Sunday 06:00 weekly refresh restarts the bot and rewrites `sourcing/reels-sources.yaml` seeds; most catches log to pino only, never to #ops-log. **Apify's monthly usage hard limit turns every fetch into "not returned" → the saved import burns its whole queue into terminal `failed` in minutes with no alert (happened 2026-09-18 01:37 UTC; 370 rows re-queued by hand); the 07:00 scout and 06:15 snapshot fail the same way until the owner raises the limit in Apify → Settings → Limits.** Instagram's 18+ profile gate hides creators from the logged-out scraper (kaeleereneofficial, tak0bell; bayleeadami returns no posts) — a logged-in throwaway account is the post-window plan; owners create it, Claude never handles the login. Discord itself hides members who cannot see a channel from @-autocomplete — owners onboard with `/model add` (its `user` box searches the whole server) until chat onboarding accepts a typed username (post-window).

## When adding a model
Owners run `/model add` in Discord (`src/modules/models/`): channels → Apify research → Claude (`prompts/model.research.md`) → files rendered by `src/modules/models/render.ts` → one GitHub commit (`src/integrations/github.ts`) → Railway redeploy loads her. `profile.md` above the staff marker and the `## Imported` captions section are machine-owned (rewritten by `/model refresh`); `voice/voice.md`, `notes.md`, hand-picked captions are human-owned. Laptop fallback: `npm run new-model`, `setup-server`, `import-captions`. Never create channels by hand.
`model.yaml → lanes` (Content Library genre slugs) is what routes library drops and event ideas to her.

## Knowledge graph (graphify) — use it before grepping
`graphify-out/` is committed and refreshed daily by `.github/workflows/graphify.yml` (also `workflow_dispatch`). Start with `graphify-out/GRAPH_REPORT.md`, then
`graphify query "<question>"`, `graphify explain "<Symbol>"`, `graphify path "A" "B"`, `graphify god-nodes` (install once: `uv tool install graphifyy`).
After a big change run `graphify update . --force && graphify cluster-only . --no-viz --no-label` and commit `graphify-out/` (or wait for the nightly job).
Railway ignores commits that only touch `graphify-out/`, `docs/`, README/CLAUDE or `.github/` (watch patterns), so graph refreshes never redeploy the bot.
