import { Events, type Message } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Conversational persona. Replies when the bot is @mentioned, replied to, or addressed by name in a model's channels.
 * Context block is built from the DB so the bot never invents numbers (persona.system.md rule 4).
 */
const MODULE = 'persona';
const BOT_NAME = process.env.BOT_NAME ?? 'Lava';

export function register(ctx: BotContext) {
  const sql = ctx.db;

  ctx.client.on(Events.MessageCreate, async (msg: Message) => {
    if (msg.author.bot || !msg.inGuild()) return;
    const model = ctx.models.forChannelOrParent(msg.channelId, msg.channel.isThread() ? msg.channel.parentId : null);
    if (!model) return;

    const me = ctx.client.user;
    if (!me) return;
    const mentioned = msg.mentions.has(me);
    const repliedToMe = msg.reference?.messageId
      ? (await msg.channel.messages.fetch(msg.reference.messageId).catch(() => null))?.author.id === me.id
      : false;
    const named = new RegExp(`\\b${BOT_NAME}\\b`, 'i').test(msg.content);
    if (!mentioned && !repliedToMe && !named) return;

    await msg.channel.sendTyping();
    const history = await recentHistory(msg, me.id);
    const system = loadPrompt('persona.system', {
      bot_name: BOT_NAME,
      model_name: model.display_name,
      model_user_id: model.discord.user_id,
      context: await contextBlock(model),
      notes: model.files().notes || '(none)',
    });

    try {
      const reply = await ctx.api.claude.chat(history, { system, maxTokens: 400 });
      if (reply) await msg.reply(reply.slice(0, 1900));
    } catch (err) {
      ctx.log.error({ err, model: model.slug }, 'persona reply failed');
    }
  });

  async function contextBlock(model: Model): Promise<string> {
    const [m] = await sql<{ week_start: string; views: number; net_followers: number; pct_non_followers: number }[]>`
      SELECT week_start::text, views, net_followers, pct_non_followers FROM bot.weekly_metrics WHERE model_slug = ${model.slug} ORDER BY week_start DESC LIMIT 1`;
    const reqs = await sql<{ brief: string; status: string; deadline: string | null }[]>`
      SELECT brief, status, deadline FROM bot.content_requests WHERE model_slug = ${model.slug} AND status NOT IN ('posted','cancelled') ORDER BY created_at DESC LIMIT 5`;
    const [{ n: reels }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM bot.reels WHERE model_slug = ${model.slug} AND status = 'new'`;
    const [live] = await sql<{ started_at: Date }[]>`SELECT started_at FROM bot.live_sessions WHERE model_slug = ${model.slug} AND ended_at IS NULL`;
    const [earn] = await sql<{ month_to_date_usd: string; month: string }[]>`
      SELECT month_to_date_usd, month FROM bot.earnings WHERE model_slug = ${model.slug} ORDER BY created_at DESC LIMIT 1`;
    return [
      `- Today: ${new Date().toISOString().slice(0, 10)} (${model.timezone})`,
      live ? `- She is currently marked LIVE since ${live.started_at.toISOString()}` : '- She is not marked live right now',
      m ? `- Last weekly IG numbers (week of ${m.week_start}): views ${m.views}, net followers ${m.net_followers}, ${m.pct_non_followers}% non-followers` : '- No weekly IG numbers on file yet',
      reqs.length ? `- Open content requests:\n${reqs.map((r) => `  • [${r.status}] ${r.brief.slice(0, 120).replace(/\n/g, ' ')}${r.deadline ? ` (by ${r.deadline})` : ''}`).join('\n')}` : '- No open content requests',
      `- Reels waiting on her board: ${reels}`,
      earn ? `- Month-to-date earnings (${earn.month}): $${Number(earn.month_to_date_usd).toLocaleString()}` : '- No earnings figure on file (say "ask Dan")',
      `- Drive root: ${model.drive.root_folder_id ? `https://drive.google.com/drive/folders/${model.drive.root_folder_id}` : 'not set'}`,
    ].join('\n');
  }

  async function recentHistory(msg: Message, botId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const fetched = await msg.channel.messages.fetch({ limit: 12, before: msg.id }).catch(() => null);
    const prior = fetched ? [...fetched.values()].reverse() : [];
    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of prior) {
      if (!m.content) continue;
      const role = m.author.id === botId ? 'assistant' : 'user';
      const content = role === 'user' ? `${m.author.displayName}: ${m.content}` : m.content;
      if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].content += `\n${content}`;
      else turns.push({ role, content });
    }
    const current = `${msg.author.displayName}: ${msg.content}`;
    if (turns.length && turns[turns.length - 1].role === 'user') turns[turns.length - 1].content += `\n${current}`;
    else turns.push({ role: 'user', content: current });
    if (turns[0].role === 'assistant') turns.shift(); // Anthropic requires the first turn to be user
    return turns;
  }

  ctx.log.info({ module: MODULE, botName: BOT_NAME }, 'persona ready');
}
