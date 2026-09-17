/**
 * Push slash commands to the guild. Run after adding/changing any command builder.
 *   npm run register-commands
 * Collects builders by instantiating each module against a throwaway context (no login needed).
 */
import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { loadModels, ModelRegistry } from '../src/config/models.js';
import { openDb } from '../src/db/client.js';
import { BotContext } from '../src/discord/context.js';
import { Claude } from '../src/integrations/anthropic.js';
import { Notion } from '../src/integrations/notion.js';
import { Drive } from '../src/integrations/drive.js';
import { Apify } from '../src/integrations/apify.js';
import { Zernio } from '../src/integrations/zernio.js';
import { log } from '../src/lib/logger.js';
import { Timers } from '../src/lib/timers.js';
import { Settings } from '../src/lib/settings.js';
import { register as setup } from '../src/modules/setup/index.js';
import { register as persona } from '../src/modules/persona/index.js';
import { register as live } from '../src/modules/live/index.js';
import { register as insights } from '../src/modules/insights/index.js';
import { register as requests } from '../src/modules/requests/index.js';
import { register as reels } from '../src/modules/reels/index.js';
import { register as captions } from '../src/modules/captions/index.js';
import { register as posting } from '../src/modules/posting/index.js';
import { register as earnings } from '../src/modules/earnings/index.js';
import { register as agency } from '../src/modules/agency/index.js';

const env = loadEnv();
const db = openDb(env.DATABASE_URL); // postgres.js is lazy: no connection is opened, modules only register handlers
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ctx = new BotContext(client, env, new ModelRegistry(loadModels()), db, new Timers(db, log), log, {
  claude: new Claude('x', env.CLAUDE_MODEL, env.CLAUDE_VISION_MODEL),
  notion: new Notion('', {}, log),
  drive: new Drive('', log),
  apify: new Apify('', '', ''),
  zernio: new Zernio(''),
}, new Settings(db));
for (const mod of [setup, persona, live, insights, requests, reels, captions, posting, earnings, agency]) mod(ctx);
for (const job of ctx.crons) job.stop();
await db.end({ timeout: 1 });

const body = [...ctx.commands.values()].map((c) => c.builder.toJSON());
const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), { body });
console.log(`registered ${body.length} commands:`, body.map((b) => `/${b.name}`).join(' '));
process.exit(0);
