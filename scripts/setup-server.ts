/**
 * Create a model's private category + channels + role in the Lava guild and print the ids to paste into model.yaml.
 *   npm run setup-server -- jane <model_discord_user_id>
 * Same code path as `/model add` in Discord (src/lib/model-structure.ts); prefer the command — it also does the research.
 */
import { Client, GatewayIntentBits, type Guild } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { loadModels } from '../src/config/models.js';
import { openDb } from '../src/db/client.js';
import { ensureModelStructure } from '../src/lib/model-structure.js';
import { Settings } from '../src/lib/settings.js';

const [slug, userId] = process.argv.slice(2);
const env = loadEnv();
const model = loadModels().find((m) => m.slug === slug);
if (!model || !userId) {
  console.error('usage: npm run setup-server -- <slug> <model_discord_user_id>   (model.yaml must exist)');
  process.exit(1);
}

const db = openDb(env.DATABASE_URL);
const settings = new Settings(db);
await settings.load().catch(() => undefined); // fine if the bot has never booted yet
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(env.DISCORD_TOKEN);
const guild: Guild = await client.guilds.fetch(model.discord.guild_id ?? env.DISCORD_GUILD_ID);
const staffIds = [...new Set([guild.ownerId, ...settings.getList('owners'), ...env.OWNER_IDS, ...env.BOT_ADMIN_IDS, ...model.discord.manager_ids])];

const ids = await ensureModelStructure(guild, { slug, displayName: model.display_name, userId, botId: client.user!.id, staffIds });

console.log(`
paste into models/${slug}/model.yaml:

discord:
  category_id: "${ids.category_id}"
  role_id: "${ids.role_id}"
  user_id: "${userId}"
  manager_ids: []
  channels:
    general: "${ids.channels.general}"
    reels_board: "${ids.channels.reels_board}"
    custom: "${ids.channels.custom}"
    notification: "${ids.channels.notification}"
    resources: "${ids.channels.resources}"
`);
client.destroy();
await db.end({ timeout: 1 });
process.exit(0);
