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
- Slash commands are defined in `src/discord/commands/*.ts` and registered by `scripts/register-commands.ts`.
- Component custom ids follow `module:action:modelSlug:entityId` (e.g. `reels:on_drive:jane:123`).
- Model timezone (`model.yaml → timezone`) governs every cron for that model.
- Logs: `ctx.log.info({ model, module }, 'message')` (pino). Also mirror important actions to the `#ops-log` channel via `ctx.ops()`.

## Where things are
- Boot & wiring → `src/index.ts`, `src/discord/client.ts`
- Model config loader → `src/config/models.ts` (validates with zod)
- All ten modules are implemented → `src/modules/<name>/index.ts`; each one's header comment is the spec.
- Content Library (agency-wide genre folders) → `src/modules/library/index.ts`, genres in `library/genres.yaml`, spec in `docs/content-library.md`. Adding a genre = a yaml entry, never code.
- Not yet wired (see README): Drive ready-to-post automation, Zernio status polling, OF earnings source.

## When adding a model
Run `npm run new-model -- <slug>`, fill `models/<slug>/model.yaml`, run `npm run import-captions -- <slug>`, then `npm run setup-server -- <slug>`. Do not create channels by hand.

## Knowledge graph
If `graphify` is installed, run `/graphify .` after large changes; `graphify-out/GRAPH_REPORT.md` is a good orientation read.
