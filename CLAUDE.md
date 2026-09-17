# CLAUDE.md — working rules for Claude Code in this repo

## What this is
A single Discord bot for an OnlyFans/creator management agency (Lava Mgmt). ~15 models, each with a private Discord category and a folder under `models/<slug>/`. The bot relays work between owners (Dan, Marissa) and models, tracks lives, parses weekly IG stats, sources reels to recreate, writes captions in each model's voice, and auto-posts via Zernio after human approval. Reference implementation we are cloning: `docs/source-analysis/Nivo-Discord-Bot-Analysis.md`.

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

## When adding a model
Owners run `/model add` in Discord (`src/modules/models/`): channels → Apify research → Claude (`prompts/model.research.md`) → files rendered by `src/modules/models/render.ts` → one GitHub commit (`src/integrations/github.ts`) → Railway redeploy loads her. `profile.md` above the staff marker and the `## Imported` captions section are machine-owned (rewritten by `/model refresh`); `voice/voice.md`, `notes.md`, hand-picked captions are human-owned. Laptop fallback: `npm run new-model`, `setup-server`, `import-captions`. Never create channels by hand.
`model.yaml → lanes` (Content Library genre slugs) is what routes library drops and event ideas to her.

## Knowledge graph (graphify) — use it before grepping
`graphify-out/` is committed and refreshed daily by `.github/workflows/graphify.yml` (also `workflow_dispatch`). Start with `graphify-out/GRAPH_REPORT.md`, then
`graphify query "<question>"`, `graphify explain "<Symbol>"`, `graphify path "A" "B"`, `graphify god-nodes` (install once: `uv tool install graphifyy`).
After a big change run `graphify update . --force && graphify cluster-only . --no-viz --no-label` and commit `graphify-out/` (or wait for the nightly job).
Railway ignores commits that only touch `graphify-out/`, `docs/`, README/CLAUDE or `.github/` (watch patterns), so graph refreshes never redeploy the bot.
