import type { BotContext } from '../../discord/context.js';

/**
 * Agency-wide layer — the one place all models are together (#agency-lounge).
 * Rules: never earnings, never one model's numbers vs another's. Shout-outs only.
 *   • Friday 5 pm: weekly shout-out — who sent insights, who cleared their reels board, who went live most.
 *   • live:ended → if a live ran ≥ 60 min, a one-liner in the lounge.
 */
const MODULE = 'agency';

export function register(ctx: BotContext) {
  const lounge = ctx.env.AGENCY_LOUNGE_CHANNEL_ID;
  if (!lounge) return;
  const sql = ctx.db;

  ctx.cron('agency:shoutouts', '0 17 * * 5', ctx.env.DEFAULT_TIMEZONE, async () => {
    const name = (slug: string) => ctx.models.get(slug)?.display_name.split(' ')[0] ?? slug;
    const insights = (await sql<{ model_slug: string }[]>`SELECT DISTINCT model_slug FROM bot.weekly_metrics WHERE created_at >= now() - interval '7 days'`).map((r) => name(r.model_slug));
    const reels = (
      await sql<{ model_slug: string; n: number }[]>`
        SELECT model_slug, COUNT(*)::int AS n FROM bot.reels WHERE status IN ('on_drive','posted') AND acted_at >= now() - interval '7 days'
        GROUP BY model_slug ORDER BY n DESC LIMIT 3`
    ).map((r) => `${name(r.model_slug)} (${r.n})`);
    const lives = (
      await sql<{ model_slug: string; mins: number }[]>`
        SELECT model_slug, ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60))::int AS mins FROM bot.live_sessions
        WHERE ended_at IS NOT NULL AND started_at >= now() - interval '7 days' GROUP BY model_slug ORDER BY mins DESC LIMIT 3`
    ).map((r) => `${name(r.model_slug)} (${r.mins} min)`);
    const lines = [
      `🔥 **week in review**`,
      insights.length ? `📊 sent their numbers: ${insights.join(', ')}` : '',
      reels.length ? `🎬 most reels knocked out: ${reels.join(', ')}` : '',
      lives.length ? `🔴 most live time: ${lives.join(', ')}` : '',
      `have a good weekend, rest up, film something silly 🫡`,
    ].filter(Boolean);
    await ctx.send(lounge, { content: lines.join('\n') });
    await ctx.ops(MODULE, 'shoutouts');
  });

  ctx.bus.on('live:ended', async ({ model, mins }: { model: { display_name: string }; mins: number }) => {
    if (mins >= 60) await ctx.send(lounge, { content: `🔴 ${model.display_name.split(' ')[0]} just did a ${mins}-minute live. respect.` });
  });
}
