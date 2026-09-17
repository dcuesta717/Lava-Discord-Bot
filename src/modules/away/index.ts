import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ChannelType, Events, MessageFlags, SlashCommandBuilder, type Message } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Away-reply (Dan: "if any of the girls message Dan the bot can reply automatically … 'this is Lava bot replying while
 * Dan is away' … some questions can be answered by the bot so it doesn't waste his time").
 *
 * Discord bots cannot read anyone's personal DMs, so this covers the two places it can:
 *   • her channel — she @mentions an owner or asks a question, and no owner answers within `delay` minutes
 *     (durable timer `away:reply`) → the bot replies with the "Lava Bot here while Dan's away" prefix.
 *   • DMs to the bot — answered right away, same rules.
 * What it may answer comes from knowledge/faq.md + the same facts the persona uses; anything about money, contracts,
 * drama, health or promises is never answered — it is forwarded to STAFF #girls-questions with a link. Every reply is
 * logged there too (bot.away_replies), so owners can correct the FAQ.
 *
 *   /away on|auto|off [delay]   on = reply immediately · auto (default) = wait `delay` min for a human · off = never
 */
const MODULE = 'away';
const PREFIX = (owner: string) => `🤖 **Lava Bot** here while ${owner}'s away — `;
const FAQ_FILE = join(process.cwd(), 'knowledge', 'faq.md');
const QUESTION_RE = /\?|^(can|could|should|do|does|is|are|when|where|how|what|why|who|which)\b/i;

interface Decision {
  answer: boolean;
  escalate: boolean;
  reply?: string;
  topic?: string;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const mode = () => ctx.settings.getString('away.mode', 'auto') as 'on' | 'auto' | 'off';
  const delayMin = () => Number(ctx.settings.get<number>('away.delay_min') ?? 15);
  const ownerName = () => ctx.settings.getString('away.owner_name', 'Dan');
  const faq = () => (existsSync(FAQ_FILE) ? readFileSync(FAQ_FILE, 'utf8') : '(no FAQ file yet)');

  // ── her channel: question or @owner → wait for a human, then cover ─────────
  ctx.client.on(Events.MessageCreate, (msg: Message) => {
    onMessage(msg).catch((err) => ctx.log.warn({ err }, 'away listener failed'));
  });

  async function onMessage(msg: Message) {
    if (msg.author.bot) return;
    if (msg.channel.type === ChannelType.DM) return handleDm(msg);
    if (!msg.inGuild() || mode() === 'off') return;
    const model = ctx.models.forChannelOrParent(msg.channelId, msg.channel.isThread() ? msg.channel.parentId : null);
    if (!model || msg.author.id !== model.discord.user_id) return;
    const me = ctx.client.user!;
    if (msg.mentions.has(me)) return; // the persona handles direct asks to the bot
    const asksOwner = ctx.ownerIds().some((id) => msg.mentions.users.has(id));
    const looksLikeQuestion = QUESTION_RE.test(msg.content.trim());
    if (!asksOwner && !looksLikeQuestion) return;
    if (mode() === 'on') return cover(model, msg.channelId, msg.id);
    await ctx.timers.schedule('away:reply', model.slug, new Date(Date.now() + delayMin() * 60_000), { channelId: msg.channelId, messageId: msg.id });
  }

  ctx.timers.on('away:reply', async (t) => {
    if (mode() === 'off') return;
    const model = ctx.models.get(t.model_slug);
    if (!model) return;
    await cover(model, String(t.payload.channelId), String(t.payload.messageId));
  });

  async function cover(model: Model, channelId: string, messageId: string) {
    const ch = await ctx.channel(channelId);
    if (!ch || !('messages' in ch)) return;
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (!msg) return;
    // did a human owner (or the bot) already answer after her message?
    const after = await ch.messages.fetch({ after: messageId, limit: 20 }).catch(() => null);
    if (after && [...after.values()].some((m) => ctx.isOwner(m.author.id) || m.author.id === ctx.client.user!.id)) return;
    const history = await ch.messages.fetch({ limit: 10, before: messageId }).catch(() => null);
    const lines = [...(history ? [...history.values()].reverse() : []), msg].filter((m) => m.content).map((m) => `${m.author.id === ctx.client.user!.id ? 'Lava Bot' : m.author.displayName}: ${m.content}`);
    await respond(model, msg, lines, 'channel');
  }

  // ── DMs to the bot ─────────────────────────────────────────────────────────
  async function handleDm(msg: Message) {
    if (mode() === 'off') return;
    const model = ctx.models.all().find((m) => m.discord.user_id === msg.author.id);
    if (!model) {
      if (ctx.isOwner(msg.author.id)) return;
      await msg.reply("hey — I only chat with Lava creators who are set up in the server. Ask Dan to add you and I'll be here.").catch(() => undefined);
      return;
    }
    const history = await msg.channel.messages.fetch({ limit: 10, before: msg.id }).catch(() => null);
    const lines = [...(history ? [...history.values()].reverse() : []), msg].filter((m) => m.content).map((m) => `${m.author.bot ? 'Lava Bot' : model.display_name}: ${m.content}`);
    await respond(model, msg, lines, 'dm');
  }

  // ── shared ─────────────────────────────────────────────────────────────────
  async function respond(model: Model, msg: Message, history: string[], where: 'channel' | 'dm') {
    let d: Decision;
    try {
      d = await ctx.api.claude.json<Decision>(
        loadPrompt('away.reply', { owner_name: ownerName(), model_name: model.display_name, faq: faq(), context: await context(model), notes: model.files().notes || '(none)', history: history.join('\n').slice(-4000) }),
        { maxTokens: 400, temperature: 0.3 },
      );
    } catch (err) {
      ctx.log.warn({ err, model: model.slug }, 'away decision failed');
      return;
    }
    if (!d || (!d.answer && !d.escalate)) return;
    const reply = (d.reply ?? '').trim();
    if (reply) await msg.reply({ content: `${PREFIX(ownerName())}${reply}`.slice(0, 1900), allowedMentions: { parse: [] } }).catch(() => undefined);
    await sql`INSERT INTO bot.away_replies (model_slug, where_, channel_id, message_id, question, reply, answered, escalated, topic)
              VALUES (${model.slug}, ${where}, ${msg.channelId}, ${msg.id}, ${msg.content.slice(0, 1000)}, ${reply || null}, ${Boolean(d.answer)}, ${Boolean(d.escalate)}, ${(d.topic ?? '').slice(0, 80)})`.catch((err) => ctx.log.warn({ err }, 'away log failed'));
    const link = where === 'channel' ? `https://discord.com/channels/${ctx.env.DISCORD_GUILD_ID}/${msg.channelId}/${msg.id}` : '(DM to the bot)';
    const staffLine = d.escalate
      ? `🚨 ${ctx.ownerMentions()} **${model.display_name}** needs a human${d.topic ? ` — ${d.topic}` : ''}: "${msg.content.slice(0, 300)}" ${link}`
      : `🤖 answered for ${model.display_name}${d.topic ? ` (${d.topic})` : ''}: "${msg.content.slice(0, 160)}" → "${reply.slice(0, 200)}" ${link}`;
    await ctx.send(ctx.ch('questions') || ctx.ch('live_alerts'), { content: staffLine.slice(0, 1900), allowedMentions: d.escalate ? { users: ctx.ownerIds() } : { parse: [] } });
    await ctx.ops(MODULE, d.escalate ? 'escalated' : 'answered', { model, data: { where, topic: d.topic } });
  }

  async function context(model: Model): Promise<string> {
    const reqs = await sql<{ brief: string; status: string; deadline: string | null }[]>`SELECT brief, status, deadline FROM bot.content_requests WHERE model_slug = ${model.slug} AND status NOT IN ('posted','cancelled') ORDER BY created_at DESC LIMIT 5`;
    const [{ n: reels }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM bot.reels WHERE model_slug = ${model.slug} AND status = 'new'`;
    const [live] = await sql<{ started_at: Date }[]>`SELECT started_at FROM bot.live_sessions WHERE model_slug = ${model.slug} AND ended_at IS NULL`;
    return [
      `- Today: ${new Date().toISOString().slice(0, 10)} (${model.timezone}); owners: Dan, Marissa`,
      `- Her channels: general <#${model.discord.channels.general}>, resources <#${model.discord.channels.resources}>, notifications <#${model.discord.channels.notification}>, reels board <#${model.discord.channels.reels_board}>`,
      `- Drive folder: ${model.drive.root_folder_id ? `https://drive.google.com/drive/folders/${model.drive.root_folder_id}` : 'not set (say it is pinned in her #resources / ask Dan)'}`,
      live ? `- She is marked LIVE since ${live.started_at.toISOString()}` : '- She is not marked live',
      reqs.length ? `- Open content requests: ${reqs.map((r) => `[${r.status}] ${r.brief.slice(0, 100).replace(/\n/g, ' ')}${r.deadline ? ` (by ${r.deadline})` : ''}`).join(' · ')}` : '- No open content requests',
      `- Reels waiting on her board: ${reels}`,
      `- Commands she can use: /live-started, /live-ended, /caption, /my-week, /request-status`,
    ].join('\n');
  }

  ctx.action('set_away_mode', {
    description: "Control the away-reply (bot answers routine questions for an owner): mode on = reply immediately, auto = wait N minutes for a human, off. Optionally the delay and whose absence it announces.",
    input: { type: 'object', properties: { mode: { type: 'string', enum: ['on', 'auto', 'off'] }, delay_minutes: { type: 'integer' }, owner_name: { type: 'string' } } },
    ownersOnly: true,
    run: async (input, actor) => {
      if (input.mode) await ctx.settings.set('away.mode', String(input.mode));
      if (input.delay_minutes) await ctx.settings.set('away.delay_min', Number(input.delay_minutes));
      if (input.owner_name) await ctx.settings.set('away.owner_name', String(input.owner_name));
      await ctx.ops(MODULE, 'settings', { actor: actor.userId, data: { mode: mode(), delay: delayMin(), owner: ownerName() } });
      return `away-reply is ${mode()}${mode() === 'auto' ? ` (waits ${delayMin()} min)` : ''}, covering for ${ownerName()}`;
    },
  });

  // ── /away ──────────────────────────────────────────────────────────────────
  ctx.command(
    new SlashCommandBuilder()
      .setName('away')
      .setDescription('Let the bot answer routine questions for Dan (owners)')
      .addStringOption((o) => o.setName('mode').setDescription('on = reply right away · auto = wait for a human first · off').addChoices({ name: 'on (reply immediately)', value: 'on' }, { name: 'auto (wait for a human first)', value: 'auto' }, { name: 'off', value: 'off' }))
      .addIntegerOption((o) => o.setName('delay').setDescription('auto mode: minutes to wait for a human (default 15)').setMinValue(1).setMaxValue(240))
      .addStringOption((o) => o.setName('owner_name').setDescription('Whose absence the bot announces (default Dan)')),
    async (i) => {
      if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const m = i.options.getString('mode');
      const d = i.options.getInteger('delay');
      const n = i.options.getString('owner_name');
      if (m) await ctx.settings.set('away.mode', m);
      if (d) await ctx.settings.set('away.delay_min', d);
      if (n) await ctx.settings.set('away.owner_name', n.trim());
      if (m || d || n) await ctx.ops(MODULE, 'settings', { actor: i.user.id, data: { mode: mode(), delay: delayMin(), owner: ownerName() } });
      const [{ n: today }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM bot.away_replies WHERE created_at > now() - interval '1 day'`;
      return i.editReply(`away-reply is **${mode()}**${mode() === 'auto' ? ` (waits ${delayMin()} min for a human)` : ''} · covering for **${ownerName()}** · ${today} reply/escalation(s) in the last 24h — see <#${ctx.ch('questions')}>. Edit what it may answer in \`knowledge/faq.md\`.`);
    },
  );
}
