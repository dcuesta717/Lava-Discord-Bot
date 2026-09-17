import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { loadPrompt } from '../../lib/prompts.js';
import { nowIso } from '../../lib/time.js';

/**
 * Earnings hype (docs/source-analysis §2.2, the "$25,054.17 … $10k over your best month" message).
 *   staff: /earnings model:<slug> mtd:<usd>   (manual until an OF-stats source is wired: see docs/architecture.md)
 *   → stores month-to-date; if it crosses best_month or goal_month (model.yaml → earnings.*) or a $5k step,
 *     Claude writes ONE hype line (prompts/earnings.hype.md) and posts it in her #general.
 * Numbers are never shown to other models (agency lounge never gets earnings).
 */
const MODULE = 'earnings';
const BOT_NAME = process.env.BOT_NAME ?? 'Lava';
const STEP = 5000;

export function register(ctx: BotContext) {
  const sql = ctx.db;

  ctx.command(
    new SlashCommandBuilder()
      .setName('earnings')
      .setDescription('Record month-to-date earnings for a model (staff)')
      .addStringOption((o) => o.setName('model').setDescription('Model slug').setRequired(true))
      .addNumberOption((o) => o.setName('mtd').setDescription('Month-to-date USD').setRequired(true))
      .addBooleanOption((o) => o.setName('quiet').setDescription("Don't post a hype message")),
    async (i) => {
      const model = ctx.models.get(i.options.getString('model', true));
      if (!model || !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only / unknown model', flags: MessageFlags.Ephemeral });
      const mtd = i.options.getNumber('mtd', true);
      const month = nowIso().slice(0, 7);
      const [prev] = await sql<{ month_to_date_usd: string }[]>`
        SELECT month_to_date_usd FROM bot.earnings WHERE model_slug = ${model.slug} AND month = ${month} ORDER BY created_at DESC LIMIT 1`;
      const before = prev ? Number(prev.month_to_date_usd) : 0;
      await sql`INSERT INTO bot.earnings (model_slug, month, month_to_date_usd, recorded_by) VALUES (${model.slug}, ${month}, ${mtd}, ${i.user.id})`;
      await i.reply({ content: `logged $${mtd.toLocaleString()} MTD for ${model.display_name}`, flags: MessageFlags.Ephemeral });

      if (i.options.getBoolean('quiet')) return;
      const { best_month_usd: best, goal_month_usd: goal } = model.earnings;
      let milestone = '';
      if (best && before < best && mtd >= best) milestone = `passed her previous best month ($${best.toLocaleString()})`;
      else if (goal && before < goal && mtd >= goal) milestone = `hit the monthly goal ($${goal.toLocaleString()})`;
      else if (Math.floor(mtd / STEP) > Math.floor(before / STEP)) milestone = `crossed $${(Math.floor(mtd / STEP) * STEP).toLocaleString()} for the month`;
      if (!milestone) return;

      const text = await ctx.api.claude.text(
        loadPrompt('earnings.hype', { bot_name: BOT_NAME, model_name: model.display_name.split(' ')[0], mtd: mtd.toLocaleString(), best: best.toLocaleString(), goal: goal.toLocaleString(), milestone }),
        { maxTokens: 150, temperature: 0.9 },
      );
      await ctx.send(model.discord.channels.general, { content: text.slice(0, 400) });
      await ctx.ops(MODULE, 'milestone', { model, actor: i.user.id, data: { mtd, milestone } });
    },
  );
}
