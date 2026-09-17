import { Events, REST, Routes } from 'discord.js';
import { loadEnv } from './config/env.js';
import { loadModels, ModelRegistry } from './config/models.js';
import { migrate, openDb } from './db/client.js';
import { createClient } from './discord/client.js';
import { BotContext } from './discord/context.js';
import { attachRouter } from './discord/router.js';
import { Claude } from './integrations/anthropic.js';
import { Notion } from './integrations/notion.js';
import { Drive } from './integrations/drive.js';
import { Apify } from './integrations/apify.js';
import { Zernio } from './integrations/zernio.js';
import { log } from './lib/logger.js';
import { Timers } from './lib/timers.js';
import { Settings } from './lib/settings.js';

import { register as setup } from './modules/setup/index.js';
import { register as persona } from './modules/persona/index.js';
import { register as live } from './modules/live/index.js';
import { register as insights } from './modules/insights/index.js';
import { register as requests } from './modules/requests/index.js';
import { register as reels } from './modules/reels/index.js';
import { register as captions } from './modules/captions/index.js';
import { register as posting } from './modules/posting/index.js';
import { register as earnings } from './modules/earnings/index.js';
import { register as agency } from './modules/agency/index.js';
import { register as library } from './modules/library/index.js';
import { register as models_ } from './modules/models/index.js';
import { register as reports } from './modules/reports/index.js';

async function main() {
  const env = loadEnv();
  const models = new ModelRegistry(loadModels());
  log.info({ models: models.all().map((m) => m.slug) }, 'models loaded');

  const db = openDb(env.DATABASE_URL);
  const ran = await migrate(db).catch((err: unknown) => {
    throw new Error(`database connection failed — ${explainDbError(err)}`, { cause: err });
  });
  if (ran.length) log.info({ ran }, 'migrations applied');
  log.info('database connected');
  const timers = new Timers(db, log);
  const settings = new Settings(db);
  await settings.load();
  const client = createClient();

  const ctx = new BotContext(client, env, models, db, timers, log, {
    claude: new Claude(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL, env.CLAUDE_VISION_MODEL),
    notion: new Notion(
      env.NOTION_TOKEN,
      {
        models: env.NOTION_DB_MODELS,
        live: env.NOTION_DB_LIVE_SESSIONS,
        metrics: env.NOTION_DB_WEEKLY_METRICS,
        requests: env.NOTION_DB_CONTENT_REQUESTS,
        reels: env.NOTION_DB_REELS_BOARD,
        posts: env.NOTION_DB_POSTS,
      },
      log,
    ),
    drive: new Drive(env.GOOGLE_SERVICE_ACCOUNT_B64, log),
    apify: new Apify(env.APIFY_TOKEN, env.APIFY_TIKTOK_ACTOR, env.APIFY_INSTAGRAM_ACTOR),
    zernio: new Zernio(env.ZERNIO_API_KEY),
  }, settings);

  // Modules register commands / components / crons / timer handlers on the context.
  for (const mod of [setup, persona, live, insights, requests, reels, captions, posting, earnings, agency, library, models_, reports]) mod(ctx);

  attachRouter(ctx);

  // Register slash commands on every boot (idempotent PUT) so Railway/VPS deploys never need a separate step.
  if (env.REGISTER_COMMANDS_ON_BOOT) {
    const body = [...ctx.commands.values()].map((c) => c.builder.toJSON());
    await new REST({ version: '10' })
      .setToken(env.DISCORD_TOKEN)
      .put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), { body })
      .catch((err: unknown) => {
        throw new Error(`could not register slash commands — ${explainDiscordError(err)}`, { cause: err });
      });
    log.info({ commands: body.map((b) => b.name) }, 'slash commands registered');
  }

  client.once(Events.ClientReady, (c) => {
    log.info({ user: c.user.tag, guild: env.DISCORD_GUILD_ID }, 'bot ready');
    timers.start();
  });

  process.on('SIGTERM', () => {
    timers.stop();
    client.destroy();
    void db.end({ timeout: 5 }).then(() => process.exit(0));
  });

  await client.login(env.DISCORD_TOKEN);
}

/** Translate the usual first-deploy failures into one plain sentence for the deploy logs. */
function explainDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code ?? '';
  if (/password authentication failed/i.test(msg)) return 'wrong database password. Supabase → Project Settings → Database → Reset database password, then rebuild DATABASE_URL with the new one.';
  if (/Tenant or user not found/i.test(msg)) return 'username is wrong for the pooler. Use the exact string from Supabase → Connect → Transaction pooler (user looks like postgres.<project-ref>).';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'host not found — DATABASE_URL host is misspelled. Copy it again from Supabase → Connect.';
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'CONNECT_TIMEOUT') return 'could not reach the database host/port. Use the Transaction pooler on port 6543.';
  return msg;
}

function explainDiscordError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 401) return 'DISCORD_TOKEN is invalid. Discord Developer Portal → Bot → Reset Token, paste the new one.';
  if (status === 403) return 'the bot is not in that server or lacks applications.commands — re-invite it with the OAuth URL from the runbook.';
  if (status === 404) return 'DISCORD_CLIENT_ID or DISCORD_GUILD_ID is wrong.';
  return msg;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`BOOT FAILED: ${msg}`);
  log.fatal({ err }, 'boot failed');
  process.exit(1);
});
