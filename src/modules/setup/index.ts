import {
  ChannelType,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
} from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { MEMBER, ROLE, clampToBot } from '../../lib/overwrites.js';

/**
 * Self-setup. On every boot the bot makes sure the shared structure exists in the guild and remembers the ids
 * in bot.settings — so nobody creates channels by hand or copies ids into .env:
 *
 *   📁 STAFF   (guild owner + /owners + admins + bot)   #live-alerts #content-requests-inbox #reels-inbox #girls-questions #daily-report #ops-log #bot-dev
 *   📁 AGENCY  (everyone)                               #agency-lounge  #announcements (owners post only)
 *
 * The guild owner is always an owner/admin. More owners via /owners add @user (updates channel permissions too).
 * .env STAFF_… / AGENCY_… ids still win if set (see BotContext.ch()).
 */
const MODULE = 'setup';

const STAFF: { key: string; name: string; topic: string }[] = [
  { key: 'live_alerts', name: 'live-alerts', topic: '🔴 who is live right now · insights reminders escalate here' },
  { key: 'content_requests_inbox', name: 'content-requests-inbox', topic: 'upload pings from the Drive watcher · draft requests here before /request' },
  { key: 'reels_inbox', name: 'reels-inbox', topic: 'paste "<model-slug> <reel url> [note]" → bot classifies + posts to her board' },
  { key: 'onboarding', name: 'new-girl-reviews', topic: '🧾 every new creator: her research + voice draft, with Approve / Notes / Redo buttons — no GitHub needed' },
  { key: 'questions', name: 'girls-questions', topic: '🤖 what the bot answered for Dan while away, and 🚨 what it flagged for a human (knowledge/faq.md decides)' },
  { key: 'daily_report', name: 'daily-report', topic: '☀️ 7 AM: who posted yesterday, engagement leaderboard, follower movers, content mix per creator (/report to run now)' },
  { key: 'ops_log', name: 'ops-log', topic: 'every bot action (also in Supabase bot.event_log)' },
  { key: 'bot_dev', name: 'bot-dev', topic: 'bot setup + dev notes' },
];
const AGENCY: { key: string; name: string; topic: string; ownersOnly?: boolean }[] = [
  { key: 'agency_lounge', name: 'agency-lounge', topic: 'all of us · Friday shout-outs · never numbers' },
  { key: 'announcements', name: 'announcements', topic: 'owners post only', ownersOnly: true },
];

export function register(ctx: BotContext) {
  ctx.client.once(Events.ClientReady, async () => {
    try {
      await ensureStructure();
    } catch (err) {
      ctx.log.error({ err }, 'self-setup failed (bot still runs; fix permissions and restart)');
    } finally {
      ctx.markReady();
    }
  });

  ctx.command(
    new SlashCommandBuilder()
      .setName('owners')
      .setDescription('Manage who counts as an owner (gets live alerts, can approve everything)')
      .addSubcommand((s) => s.setName('add').setDescription('Add an owner').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('remove').setDescription('Remove an owner').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('List owners')),
    async (i) => {
      if (!ctx.isAdmin(i.user.id)) return i.reply({ content: 'admins only (guild owner or BOT_ADMIN_IDS)', flags: MessageFlags.Ephemeral });
      const sub = i.options.getSubcommand();
      const extra = ctx.settings.getList('owners');
      if (sub === 'list') return i.reply({ content: `owners: ${ctx.ownerIds().map((id) => `<@${id}>`).join(' ') || '(none)'}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      const user = i.options.getUser('user', true);
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const next = sub === 'add' ? [...new Set([...extra, user.id])] : extra.filter((id) => id !== user.id);
      await ctx.settings.set('owners', next);
      await ensureStructure(); // re-apply channel permissions
      await ctx.ops(MODULE, `owners:${sub}`, { actor: i.user.id, data: { user: user.id } });
      await i.editReply(`${sub === 'add' ? 'added' : 'removed'} <@${user.id}> — owners now: ${ctx.ownerIds().map((id) => `<@${id}>`).join(' ')}`);
    },
  );

  ctx.action('add_owner', {
    description: 'Make a Discord user an owner (gets alerts, STAFF channels, can approve everything). Needs the user id from an @mention (<@123…> → digits). The user must be in the server.',
    input: { type: 'object', properties: { discord_user_id: { type: 'string', description: 'digits of the user id' } }, required: ['discord_user_id'] },
    ownersOnly: true,
    run: async (input, actor) => {
      const id = String(input.discord_user_id).replace(/[<@!>]/g, '');
      if (!/^\d{15,22}$/.test(id)) return 'I need the person as an @mention (or their Discord user id)';
      const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) return `<@${id}> is not in the server yet — invite them first (Lava HQ → Invite People), then ask me again`;
      const next = [...new Set([...ctx.settings.getList('owners'), id])];
      await ctx.settings.set('owners', next);
      await ensureStructure();
      await ctx.ops(MODULE, 'owners:add', { actor: actor.userId, data: { user: id } });
      return `added <@${id}> as an owner — owners now: ${ctx.ownerIds().map((x) => `<@${x}>`).join(' ')}`;
    },
  });
  ctx.action('remove_owner', {
    description: 'Remove a user from the owners list (the server owner can never be removed).',
    input: { type: 'object', properties: { discord_user_id: { type: 'string' } }, required: ['discord_user_id'] },
    ownersOnly: true,
    run: async (input, actor) => {
      const id = String(input.discord_user_id).replace(/[<@!>]/g, '');
      const next = ctx.settings.getList('owners').filter((x) => x !== id);
      await ctx.settings.set('owners', next);
      await ensureStructure();
      await ctx.ops(MODULE, 'owners:remove', { actor: actor.userId, data: { user: id } });
      return `removed <@${id}> — owners now: ${ctx.ownerIds().map((x) => `<@${x}>`).join(' ')}`;
    },
  });
  ctx.action('list_owners', {
    description: 'Who counts as an owner (gets alerts, can approve everything).',
    input: { type: 'object', properties: {} },
    run: async () => `owners: ${ctx.ownerIds().map((id) => `<@${id}>`).join(' ') || 'none'} (add with /owners add @user)`,
  });

  async function ensureStructure() {
    const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
    await guild.channels.fetch();
    if (ctx.settings.getString('guild.owner_id') !== guild.ownerId) await ctx.settings.set('guild.owner_id', guild.ownerId);
    const me = ctx.client.user!.id;
    const owners = ctx.ownerIds();

    // Explicit types: discord.js cannot tell a raw user id from a role id unless the user is cached.
    const R = ROLE;
    const M = MEMBER;
    const staffOverwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, type: R, deny: [PermissionFlagsBits.ViewChannel] },
      { id: me, type: M, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory] },
      ...owners.map((id) => ({ id, type: M, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions] })),
    ];
    const agencyOverwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, type: R, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.AttachFiles] },
      { id: me, type: M, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ];
    const announceOverwrites: OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, type: R, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] },
      { id: me, type: M, allow: [PermissionFlagsBits.SendMessages] },
      ...owners.map((id) => ({ id, type: M, allow: [PermissionFlagsBits.SendMessages] })),
    ];

    const clamp = await clampToBot(guild);

    const staffCat = await ensureCategory(guild, 'staff', 'STAFF', clamp(staffOverwrites));
    const agencyCat = await ensureCategory(guild, 'agency', 'AGENCY', clamp(agencyOverwrites));

    const created: string[] = [];
    for (const c of STAFF) if (await ensureText(guild, staffCat, c.key, c.name, c.topic, clamp(staffOverwrites))) created.push(`#${c.name}`);
    for (const c of AGENCY) if (await ensureText(guild, agencyCat, c.key, c.name, c.topic, clamp(c.ownersOnly ? announceOverwrites : agencyOverwrites))) created.push(`#${c.name}`);

    if (created.length) {
      await ctx.send(ctx.ch('bot_dev'), {
        content: [
          `👋 first boot — I set up: ${created.join(', ')}.`,
          `owners right now: ${owners.map((id) => `<@${id}>`).join(' ')} (add more with \`/owners add @user\`)`,
          `next: add a model — \`npm run new-model\` + \`npm run setup-server\` from the repo (see docs/runbook.md), then she can run /live-started, /caption, /my-week in her channel.`,
        ].join('\n'),
        allowedMentions: { parse: [] },
      });
      await ctx.ops(MODULE, 'structure-created', { data: { created } });
    }
  }

  async function ensureCategory(guild: Guild, key: string, name: string, overwrites: OverwriteResolvable[]): Promise<CategoryChannel> {
    const savedId = ctx.settings.getString(`categories.${key}`);
    let cat = (savedId ? guild.channels.cache.get(savedId) : undefined) as CategoryChannel | undefined;
    if (!cat || cat.type !== ChannelType.GuildCategory) {
      cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === name) as CategoryChannel | undefined;
    }
    if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    else await cat.permissionOverwrites.set(overwrites).catch((err) => ctx.log.warn({ err, cat: name }, 'could not update category permissions'));
    if (ctx.settings.getString(`categories.${key}`) !== cat.id) await ctx.settings.set(`categories.${key}`, cat.id);
    return cat;
  }

  /** Returns true when the channel was newly created. */
  async function ensureText(guild: Guild, parent: CategoryChannel, key: string, name: string, topic: string, overwrites: OverwriteResolvable[]): Promise<boolean> {
    const savedId = ctx.settings.getString(`channels.${key}`);
    let ch = savedId ? guild.channels.cache.get(savedId) : undefined;
    if (!ch || ch.type !== ChannelType.GuildText) {
      ch = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.parentId === parent.id && c.name === name);
    }
    let created = false;
    if (!ch) {
      ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id, topic, permissionOverwrites: overwrites });
      created = true;
    } else if (ch.type === ChannelType.GuildText) {
      await ch.permissionOverwrites.set(overwrites).catch((err) => ctx.log.warn({ err, channel: name }, 'could not update channel permissions'));
    }
    if (ctx.settings.getString(`channels.${key}`) !== ch.id) await ctx.settings.set(`channels.${key}`, ch.id);
    return created;
  }
}
