/**
 * Create a model's private category + channels + role in the Lava guild and print the ids to paste into model.yaml.
 *   npm run setup-server -- amari <model_discord_user_id>
 * Template mirrors Nivo HQ (docs/source-analysis §2.1). Idempotent-ish: skips channels that already exist by name.
 */
import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits, type CategoryChannel, type Guild, type OverwriteResolvable } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { loadModels } from '../src/config/models.js';

const [slug, userId] = process.argv.slice(2);
const env = loadEnv();
const model = loadModels().find((m) => m.slug === slug);
if (!model || !userId) {
  console.error('usage: npm run setup-server -- <slug> <model_discord_user_id>   (model.yaml must exist)');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(env.DISCORD_TOKEN);
const guild: Guild = await client.guilds.fetch(model.discord.guild_id ?? env.DISCORD_GUILD_ID);
await guild.roles.fetch();
await guild.channels.fetch();

const roleName = `model-${slug}`;
const role = guild.roles.cache.find((r) => r.name === roleName) ?? (await guild.roles.create({ name: roleName, mentionable: false }));
await guild.members.fetch(userId).then((m) => m.roles.add(role)).catch(() => console.warn('could not add role to user — is she in the server yet?'));

const overwrites: OverwriteResolvable[] = [
  { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
  { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseApplicationCommands] },
  { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions] },
  ...[...env.OWNER_IDS, ...env.BOT_ADMIN_IDS, ...model.discord.manager_ids].map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] })),
];

const catName = model.display_name;
const category =
  (guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === catName) as CategoryChannel | undefined) ??
  (await guild.channels.create({ name: catName, type: ChannelType.GuildCategory, permissionOverwrites: overwrites }));

const spec: { key: string; name: string; type: ChannelType.GuildText | ChannelType.GuildForum | ChannelType.GuildVoice; readOnlyForModel?: boolean }[] = [
  { key: 'general', name: '💬-general-chat', type: ChannelType.GuildText },
  { key: 'reels_board', name: '🎬-reels-copy-board', type: ChannelType.GuildForum, readOnlyForModel: true },
  { key: 'custom', name: '🌸-custom', type: ChannelType.GuildText },
  { key: 'notification', name: '🔔-notification', type: ChannelType.GuildText },
  { key: 'resources', name: '📚-resources', type: ChannelType.GuildText },
  { key: 'call', name: 'call', type: ChannelType.GuildVoice },
];

const ids: Record<string, string> = {};
for (const s of spec) {
  const existing = guild.channels.cache.find((c) => c.parentId === category.id && c.name === s.name);
  if (existing) {
    ids[s.key] = existing.id;
    continue;
  }
  const perms: OverwriteResolvable[] = s.readOnlyForModel
    ? overwrites.map((o) => (o.id === role.id ? { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads] } : o))
    : overwrites;
  const ch = await guild.channels.create({ name: s.name, type: s.type, parent: category.id, permissionOverwrites: perms });
  ids[s.key] = ch.id;
}

console.log(`
paste into models/${slug}/model.yaml:

discord:
  category_id: "${category.id}"
  role_id: "${role.id}"
  user_id: "${userId}"
  manager_ids: []
  channels:
    general: "${ids.general}"
    reels_board: "${ids.reels_board}"
    custom: "${ids.custom}"
    notification: "${ids.notification}"
    resources: "${ids.resources}"
`);
client.destroy();
process.exit(0);
