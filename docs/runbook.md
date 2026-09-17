# Runbook

## First run
1. Discord Developer Portal → New Application → Bot → copy token → enable **Message Content** + **Server Members** intents. OAuth2 URL with scopes `bot applications.commands` and the permissions in `docs/discord-server-template.md`; invite to the Lava guild.
2. Create the STAFF + AGENCY channels by hand; put their ids in `.env`. Put Dan's user id in `BOT_ADMIN_IDS`, Dan + Marissa in `OWNER_IDS`.
3. `cp .env.example .env`, fill Discord + Anthropic keys and `DATABASE_URL`.
   - Supabase project **lava-discord-bot** (org Lava MGMT, ref `vyvxsgoirbypqxcvpled`) already exists with the `bot` schema applied.
   - Dashboard → Project Settings → Database → *Reset database password* (the password is only shown once) → Connect → **Transaction pooler** URI (port 6543) → paste as `DATABASE_URL`.
   - Local dev without Supabase: `postgres://postgres:postgres@localhost:5432/lava` against any Postgres ≥ 14; migrations run at boot.
4. `npm install && npm run register-commands && npm run dev`.
5. Add the first model from Discord: `/model add name:"Jane Doe" user:@jane instagram:janedoe` (needs `APIFY_TOKEN` and `GITHUB_TOKEN`, below). ~2 minutes later she is live and the bot welcomes her in her #general. Laptop fallback: `npm run new-model -- <slug> "<Name>" <ABC>` → `npm run setup-server -- <slug> <her_user_id>` → paste ids → push.
6. In her #general: `/live-started` → check #live-alerts → wait 40 min (or set `check_in_after_min: 1` in model.yaml to test) → buttons appear → `/live-ended`.

## Adding integrations
- **Apify** (needed for the Content Library inbox + scout and per-model reels): sign up at apify.com → Settings → Integrations → copy the API token → Railway variable `APIFY_TOKEN` → Deploy. Defaults: `clockworks/tiktok-scraper`, `apify/instagram-scraper` (pay-per-result, ≈ $2.30 / 1 000). If you buy different actors, extend `normalize()` in `src/integrations/apify.ts` with their field names. `npm run import-captions -- <slug>` is the cheapest way to see an actor's output shape. Then seed the library: `/library source add folder:golf value:@handle @handle2` per folder, and `/library scout` to fill it the first time.
- **Drive**: create a service account in Google Cloud, enable Drive API, download JSON, `base64 -i key.json` → `GOOGLE_SERVICE_ACCOUNT_B64`; share the "Lava Content" shared drive with the service-account email (Content manager).
- **Zernio**: API key → `.env`; `curl -H "Authorization: Bearer $ZERNIO_API_KEY" https://zernio.com/api/v1/accounts` → paste each model's account ids into `model.yaml → zernio.accounts`.
- **GitHub** (needed for `/model add` / `refresh` / `lanes` to write `models/<slug>/`): GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Generate: repository access **only Lava-Discord-Bot**, permissions **Contents: Read and write**, nothing else → Railway variable `GITHUB_TOKEN` (+ `GITHUB_REPO` if the repo moves). The bot commits as the token owner; each onboarding is one commit and Railway redeploys from it.
- **Notion**: internal integration token; create the databases in `docs/notion-schema.md`; share each with the integration; ids into `.env`.

## Deploy
Railway (`vars.DEPLOY_TARGET=railway`) or a VPS with pm2 (`vps`). Set every `.env` value as a secret. No disk to persist — the database is Supabase (daily backups are on by default in the Supabase dashboard).

## Gotchas
- Slash commands only update after `npm run register-commands`.
- Discord uploads on a non-boosted server: 25 MB. For guaranteed playback on the reels board, download the mp4 (Apify `videoUrl`) and attach it when < 25 MB; otherwise post the link.
- Forum threads auto-archive; `threadForCategory()` un-archives on demand.
- Timers poll every 15 s; a redeploy never loses a check-in (rows in `timers`).
- Vision parse needs the **Overview** tab; the prompt returns `confidence: 0` for anything else and the bot asks again.
- Zernio `scheduledFor` is local wall-clock in `timezone` (no offset) — posting.ts formats it that way.
- If the persona gets weird: the system prompt is `prompts/persona.system.md`; hard rules are at the top; `notes.md` is background only.

## Daily ops for Dan/Marissa
- New girl: `/model add name: user: instagram: tiktok:` → read her `profile.md` in GitHub → 10 min with her on `voice/voice.md` → `/model lanes` if the folders the bot picked are off
- Library: paste any IG/TikTok link in `#📥-library-inbox` (add a word to force a folder) · `/library stats` · `/library source add` to teach the scout new accounts
- Requests: `/request model:<slug> items:"…" deadline:"…"`
- Reels: paste `<slug> <url>` in #reels-inbox
- Captions: `/caption model:<slug> brief:"…"` (or she runs it in her channel)
- Posts: `/post model:<slug> media_url:<…> caption_id:<n>` → tap ✅ on the preview
- Earnings: `/earnings model:<slug> mtd:<usd>` (add `quiet:true` to skip the hype message)
- Numbers: `/my-week` in her channel

## Supabase notes
- Tables live in schema `bot`, not `public`, so they are **not** reachable through the anon/publishable key or PostgREST (verified: `anon`/`authenticated` have no USAGE on the schema). The bot connects as `postgres`, which has `bypassrls`.
- Supabase's table list will still nag that RLS is off. Enabling it is harmless for the bot and adds defence in depth — run once in the SQL editor if you want the warning gone:
  ```sql
  ALTER TABLE bot.timers, bot.live_sessions, bot.weekly_metrics, bot.content_requests, bot.reels,
              bot.captions, bot.posts, bot.earnings, bot.event_log, bot._migrations ENABLE ROW LEVEL SECURITY;
  ```
- Dashboards: Table Editor → schema `bot`. Useful views to save: `event_log` ordered by `at desc`, `captions` where `status <> 'pending'` (edit rate), `live_sessions` per model.
- Adding a table/column: new file `src/db/migrations/002_<name>.sql`; it runs at next boot and is recorded in `bot._migrations`.
