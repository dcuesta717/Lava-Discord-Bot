import { Events } from 'discord.js';
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

import { register as persona } from './modules/persona/index.js';
import { register as live } from './modules/live/index.js';
import { register as insights } from './modules/insights/index.js';
import { register as requests } from './modules/requests/index.js';
import { register as reels } from './modules/reels/index.js';
import { register as captions } from './modules/captions/index.js';
import { register as posting } from './modules/posting/index.js';
import { register as earnings } from './modules/earnings/index.js';
import { register as agency } from './modules/agency/index.js';

async function main() {
  const env = loadEnv();
  const models = new ModelRegistry(loadModels());
  log.info({ models: models.all().map((m) => m.slug) }, 'models loaded');

  const db = openDb(env.DATABASE_URL);
  const ran = await migrate(db);
  if (ran.length) log.info({ ran }, 'migrations applied');
  const timers = new Timers(db, log);
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
  });

  // Modules register commands / components / crons / timer handlers on the context.
  for (const mod of [persona, live, insights, requests, reels, captions, posting, earnings, agency]) mod(ctx);

  attachRouter(ctx);

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

main().catch((err) => {
  log.fatal({ err }, 'boot failed');
  process.exit(1);
});
