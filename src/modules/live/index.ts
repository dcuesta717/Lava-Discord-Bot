import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { fmtLocal, minutesFromNow, nowIso } from '../../lib/time.js';

/**
 * Live tracker — a 1:1 port of Nivo's flow (docs/source-analysis §2.2):
 *   /live-started  → "Live started — team notified ✅" + alert owners
 *   +40 min        → "Are you still on LIVE?" [🟢 Yes, still live] [🔴 No, I ended it]
 *   Yes            → ask again every 30 min
 *   No / /live-ended → end, notify owners, confirm
 *   no answer for 2 h total → auto-end + notify
 * All delays come from models/<slug>/model.yaml → live.*  and are stored as durable timers (Postgres).
 */
interface Session {
  id: number;
  model_slug: string;
  platform: string;
  started_at: Date;
  ended_at: Date | null;
  checkins: number;
  alert_message_id: string | null;
}

const MODULE = 'live';

export function register(ctx: BotContext) {
  const sql = ctx.db;

  const openSession = async (slug: string) =>
    (await sql<Session[]>`SELECT * FROM bot.live_sessions WHERE model_slug = ${slug} AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`)[0];
  const byId = async (id: number) => (await sql<Session[]>`SELECT * FROM bot.live_sessions WHERE id = ${id}`)[0];

  // ── commands ────────────────────────────────────────────────────────────────
  ctx.command(
    new SlashCommandBuilder()
      .setName('live-started')
      .setDescription("Tell the team you're live")
      .addStringOption((o) =>
        o.setName('platform').setDescription('Where').addChoices({ name: 'TikTok', value: 'tiktok' }, { name: 'Instagram', value: 'instagram' }, { name: 'OnlyFans', value: 'onlyfans' }),
      ),
    async (i, model) => {
      if (!model) return i.reply({ content: 'run this inside your own channel 🙏', flags: MessageFlags.Ephemeral });
      const existing = await openSession(model.slug);
      if (existing) {
        return i.reply({ content: `you're already marked live since ${fmtLocal(existing.started_at.toISOString(), model.timezone)} — run /live-ended first if that's wrong`, flags: MessageFlags.Ephemeral });
      }
      const platform = i.options.getString('platform') ?? 'tiktok';
      const [{ id: sessionId }] = await sql<{ id: number }[]>`
        INSERT INTO bot.live_sessions (model_slug, platform, started_at) VALUES (${model.slug}, ${platform}, now()) RETURNING id`;

      await ctx.timers.schedule('live:checkin', model.slug, minutesFromNow(model.live.check_in_after_min), { sessionId: Number(sessionId) });
      await ctx.timers.schedule('live:timeout', model.slug, minutesFromNow(model.live.auto_end_after_min), { sessionId: Number(sessionId) });

      await i.reply(`**Live started** — team notified ✅`);
      const alert = await ctx.send(ctx.env.STAFF_LIVE_ALERTS_CHANNEL_ID, {
        content: `🔴 ${ctx.ownerMentions()} **${model.display_name} is LIVE** on ${platform} · started ${fmtLocal(nowIso(), model.timezone)}`,
      });
      if (alert) await sql`UPDATE bot.live_sessions SET alert_message_id = ${alert.id} WHERE id = ${sessionId}`;
      await ctx.api.notion.createRow('live', `${model.display_name} · ${platform} · ${nowIso().slice(0, 10)}`, { Model: model.display_name, Platform: platform, Started: nowIso() });
      await ctx.ops(MODULE, 'started', { model, actor: i.user.id, data: { sessionId, platform } });
    },
  );

  ctx.command(new SlashCommandBuilder().setName('live-ended').setDescription("Tell the team you're off live"), async (i, model) => {
    if (!model) return i.reply({ content: 'run this inside your own channel 🙏', flags: MessageFlags.Ephemeral });
    const session = await openSession(model.slug);
    if (!session) return i.reply({ content: "you're not marked live right now — nothing to end", flags: MessageFlags.Ephemeral });
    await endSession(session, model, 'command', i.user.id);
    await i.reply(`**Live ended** — team notified ✅`);
  });

  // ── buttons ─────────────────────────────────────────────────────────────────
  ctx.component('live:still', async (i, parts, model) => {
    const session = await byId(Number(parts[3]));
    if (!model || !session || session.ended_at) return i.update({ content: 'this live already ended ✅', components: [] });
    await ctx.timers.schedule('live:checkin', model.slug, minutesFromNow(model.live.repeat_every_min), { sessionId: Number(session.id) });
    await sql`UPDATE bot.live_sessions SET checkins = checkins + 1 WHERE id = ${session.id}`;
    await i.update({ content: `🟢 still live — got it, I'll check again in ${model.live.repeat_every_min} min`, components: [] });
  });

  ctx.component('live:ended', async (i, parts, model) => {
    const session = await byId(Number(parts[3]));
    if (!model || !session || session.ended_at) return i.update({ content: 'this live already ended ✅', components: [] });
    await endSession(session, model, 'button', i.user.id);
    await i.update({ content: `🔴 **Live ended** — team notified ✅ (you didn't need to run /live-ended)`, components: [] });
  });

  // ── durable timers ──────────────────────────────────────────────────────────
  ctx.timers.on('live:checkin', async (t) => {
    const session = await byId(Number(t.payload.sessionId));
    const model = ctx.models.get(t.model_slug);
    if (!session || !model || session.ended_at) return;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`live:still:${model.slug}:${session.id}`).setLabel('Yes, still live').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`live:ended:${model.slug}:${session.id}`).setLabel('No, I ended it').setStyle(ButtonStyle.Danger),
    );
    await ctx.send(model.discord.channels.general, { content: `<@${model.discord.user_id}> Are you still on LIVE?`, components: [row] });
  });

  ctx.timers.on('live:timeout', async (t) => {
    const session = await byId(Number(t.payload.sessionId));
    const model = ctx.models.get(t.model_slug);
    if (!session || !model || session.ended_at) return;
    await endSession(session, model, 'timeout');
    await ctx.send(model.discord.channels.general, {
      content: `⏱️ no answer for a while so I told the team your live ended (auto-ended after ${model.live.auto_end_after_min} min). If you're actually still on, just run /live-started again.`,
    });
  });

  // ── shared ──────────────────────────────────────────────────────────────────
  async function endSession(session: Session, model: Model, by: 'command' | 'button' | 'timeout', actor?: string) {
    await sql`UPDATE bot.live_sessions SET ended_at = now(), ended_by = ${by} WHERE id = ${session.id} AND ended_at IS NULL`;
    await ctx.timers.cancelWhere(['live:checkin', 'live:timeout'], model.slug, 'sessionId', Number(session.id));
    const mins = Math.round((Date.now() - session.started_at.getTime()) / 60_000);
    await ctx.send(ctx.env.STAFF_LIVE_ALERTS_CHANNEL_ID, {
      content: `⚫ **${model.display_name} ended live** · ${mins} min · ${by === 'timeout' ? 'auto-ended (no answer)' : by === 'button' ? 'via check-in button' : 'via /live-ended'}`,
    });
    await ctx.ops(MODULE, 'ended', { model, actor, data: { sessionId: session.id, by, mins } });
    ctx.bus.emit('live:ended', { model, session, mins, by });
  }
}
