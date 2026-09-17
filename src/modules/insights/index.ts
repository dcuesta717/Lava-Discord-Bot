import { Events, MessageFlags, SlashCommandBuilder, type Message } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { fetchImageAsBase64 } from '../../integrations/anthropic.js';
import { loadPrompt } from '../../lib/prompts.js';
import { previousWeekRange } from '../../lib/time.js';

/**
 * Weekly IG insights (docs/source-analysis §2.5):
 *   cron (model.insights.cron, model tz) → "👋 hey <name>! can u send a screenshot of ur instagram insights for the week of <range>"
 *   image posted in #notification → 👀 → "aight lemme read this…" → vision parse → "✅ got it" + numbers + WoW delta
 *   reminder cron if nothing arrived.
 *   /my-week → last numbers on demand.
 */
const MODULE = 'insights';

interface Parsed {
  date_range_text: string | null;
  views: number | null;
  net_followers: number | null;
  interactions: number | null;
  pct_followers: number | null;
  pct_non_followers: number | null;
  viewers: number | null;
  reels_views: number | null;
  posts_views: number | null;
  stories_views: number | null;
  live_views: number | null;
  confidence: number;
  notes: string;
}

type MetricRow = Record<string, number | string | null>;

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const lastTwo = (slug: string) =>
    sql<MetricRow[]>`SELECT *, week_start::text AS week_start FROM bot.weekly_metrics WHERE model_slug = ${slug} ORDER BY week_start DESC LIMIT 2`;

  for (const model of ctx.models.all()) {
    ctx.cron(`insights:ask:${model.slug}`, model.insights.cron, model.timezone, async () => {
      const { label, start, end } = previousWeekRange(model.timezone);
      await ctx.send(model.discord.channels.notification, {
        content: `👋 hey ${model.display_name.split(' ')[0]}! can u send a screenshot of ur **instagram insights** for the week of **${label}**\n*(insights → overview → set the date range to ${start.day}–${end.day})*`,
      });
    });
    ctx.cron(`insights:remind:${model.slug}`, model.insights.reminder_cron, model.timezone, async () => {
      const { start, label } = previousWeekRange(model.timezone);
      const [has] = await sql`SELECT 1 FROM bot.weekly_metrics WHERE model_slug = ${model.slug} AND week_start = ${start.toISODate()}`;
      if (has) return;
      await ctx.send(model.discord.channels.notification, { content: `<@${model.discord.user_id}> still need that insights screenshot for **${label}** when u get a sec 🙏` });
      await ctx.send(ctx.ch('live_alerts'), { content: `📉 ${model.display_name} hasn't sent insights for ${label} yet` });
    });
  }

  ctx.client.on(Events.MessageCreate, async (msg: Message) => {
    if (msg.author.bot) return;
    const model = ctx.models.forChannel(msg.channelId);
    if (!model || msg.channelId !== model.discord.channels.notification) return;
    const image = msg.attachments.find((a) => (a.contentType ?? '').startsWith('image/'));
    if (!image) return;
    await handleScreenshot(msg, model, image.url);
  });

  ctx.command(new SlashCommandBuilder().setName('my-week').setDescription('Show the last weekly Instagram numbers'), async (i, model) => {
    if (!model) return i.reply({ content: 'run this in a model channel', flags: MessageFlags.Ephemeral });
    const rows = await lastTwo(model.slug);
    if (!rows.length) return i.reply('no numbers on file yet — send an insights screenshot in #notification');
    await i.reply(format(rows[0], rows[1]));
  });

  async function handleScreenshot(msg: Message, model: Model, url: string) {
    await msg.react('👀').catch(() => undefined);
    const thinking = await msg.reply('👀 aight lemme read this…');
    try {
      const img = await fetchImageAsBase64(url);
      const parsed = await ctx.api.claude.json<Parsed>(loadPrompt('insights.parse'), { maxTokens: 500 }, [img]);
      if (parsed.confidence < 0.5 || parsed.views === null) {
        await thinking.edit(`hmm that doesn't look like the Insights → Overview screen 🤔 (${parsed.notes || 'try again with the overview tab + the right date range'})`);
        return;
      }
      const { start, end } = previousWeekRange(model.timezone);
      await sql`
        INSERT INTO bot.weekly_metrics (model_slug, week_start, week_end, views, net_followers, interactions, pct_followers, pct_non_followers, reels_views, posts_views, stories_views, live_views, screenshot_url, raw_json)
        VALUES (${model.slug}, ${start.toISODate()}, ${end.toISODate()}, ${parsed.views}, ${parsed.net_followers}, ${parsed.interactions}, ${parsed.pct_followers}, ${parsed.pct_non_followers}, ${parsed.reels_views}, ${parsed.posts_views}, ${parsed.stories_views}, ${parsed.live_views}, ${url}, ${sql.json(parsed as never)})
        ON CONFLICT (model_slug, week_start) DO UPDATE SET
          views = EXCLUDED.views, net_followers = EXCLUDED.net_followers, interactions = EXCLUDED.interactions,
          pct_followers = EXCLUDED.pct_followers, pct_non_followers = EXCLUDED.pct_non_followers,
          reels_views = EXCLUDED.reels_views, posts_views = EXCLUDED.posts_views, stories_views = EXCLUDED.stories_views,
          live_views = EXCLUDED.live_views, screenshot_url = EXCLUDED.screenshot_url, raw_json = EXCLUDED.raw_json`;
      const [cur, prev] = await lastTwo(model.slug);
      await thinking.edit(format(cur, prev));
      await ctx.api.notion.createRow('metrics', `${model.display_name} · week of ${start.toISODate()}`, {
        Model: model.display_name,
        'Week start': start.toISODate() ?? undefined,
        Views: parsed.views ?? undefined,
        'Net followers': parsed.net_followers ?? undefined,
        Interactions: parsed.interactions ?? undefined,
        '% non-followers': parsed.pct_non_followers ?? undefined,
        Screenshot: url,
      });
      await ctx.ops(MODULE, 'parsed', { model, actor: msg.author.id, data: { views: parsed.views, confidence: parsed.confidence } });
      ctx.bus.emit('insights:parsed', { model, parsed });
    } catch (err) {
      ctx.log.error({ err, model: model.slug }, 'insights parse failed');
      await thinking.edit("couldn't read that one 😵‍💫 can u send it again? (overview tab, full screen)");
    }
  }

  function format(cur: MetricRow, prev?: MetricRow) {
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
    const n = (v: unknown) => (num(v) === null ? 'N/A' : num(v)!.toLocaleString());
    const delta = (k: string) => {
      const a = num(cur[k]), b = num(prev?.[k]);
      if (a === null || b === null || b === 0) return '';
      const pct = Math.round(((a - b) / b) * 100);
      return ` (${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs last week)`;
    };
    const views = num(cur.views), nf = num(cur.net_followers);
    const ratio = views !== null && nf !== null && nf > 0 ? (views / nf).toFixed(0) : 'N/A';
    return [
      `✅ got it`,
      `> views: **${n(cur.views)}**${delta('views')}`,
      `> net followers: **${nf !== null && nf > 0 ? '+' : ''}${n(cur.net_followers)}**${delta('net_followers')}`,
      `> view ratio (views per new follower): **${ratio}**`,
      `> % followers: **${cur.pct_followers ?? 'N/A'}%**`,
      `> % non-followers: **${cur.pct_non_followers ?? 'N/A'}%**`,
    ].join('\n');
  }
}
