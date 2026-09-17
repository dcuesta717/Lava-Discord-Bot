import { ChannelType, Events, type Message } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { runAgent, type AgentTool } from '../../integrations/anthropic.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Operator chat (Dan: "owners should be able to say 'hey @lavabot we're onboarding a new girl' and just chat with it").
 *
 * When an OWNER @mentions the bot, replies to it, or DMs it — anywhere outside a model's private channels (those belong
 * to the persona) — Claude gets the conversation plus every `ctx.action()` the modules registered as tools, and runs
 * them (tool-use loop, ≤ 6 turns). Slow actions post "on it…" first and keep the typing indicator alive.
 * Non-owners who mention the bot in staff channels get a one-liner.
 */
const MODULE = 'operator';
const BOT_NAME = process.env.BOT_NAME ?? 'Lava';

export function register(ctx: BotContext) {
  const busy = new Set<string>(); // channel ids with a run in flight

  ctx.client.on(Events.MessageCreate, async (msg: Message) => {
    if (msg.author.bot) return;
    const me = ctx.client.user;
    if (!me) return;
    const isDm = msg.channel.type === ChannelType.DM;
    if (!isDm) {
      if (!msg.inGuild()) return;
      // model channels belong to the persona / away modules
      if (ctx.models.forChannelOrParent(msg.channelId, msg.channel.isThread() ? msg.channel.parentId : null)) return;
      const mentioned = msg.mentions.has(me);
      const repliedToMe = msg.reference?.messageId ? (await msg.channel.messages.fetch(msg.reference.messageId).catch(() => null))?.author.id === me.id : false;
      if (!mentioned && !repliedToMe) return;
    }
    if (!ctx.isOwner(msg.author.id)) {
      if (!isDm) await msg.reply({ content: `hey — I take instructions from the owners (${ctx.ownerMentions()}). If you're a creator, your channel is where I can help.`, allowedMentions: { parse: [] } }).catch(() => undefined);
      return;
    }
    if (busy.has(msg.channelId)) return void msg.react('⏳').catch(() => undefined);
    busy.add(msg.channelId);
    const ch = msg.channel;
    const sendTyping = () => ('sendTyping' in ch ? ch.sendTyping().catch(() => undefined) : Promise.resolve());
    const typing = setInterval(() => void sendTyping(), 8000);
    await sendTyping();
    try {
      const history = await recentHistory(msg, me.id);
      const tools = buildTools(msg);
      const system = loadPrompt('operator.system', { owner_names: ctx.ownerMentions() || 'Dan, Marissa', context: await context() });
      const res = await runAgent(ctx.api.claude, history, tools, {
        system,
        maxTokens: 900,
        maxTurns: 6,
        onToolStart: async (name) => {
          const a = ctx.actions.get(name);
          if (a?.slow) await msg.reply({ content: `on it — ${name.replace(/_/g, ' ')}…`, allowedMentions: { parse: [] } }).catch(() => undefined);
        },
      });
      if (res.text) await msg.reply({ content: res.text.slice(0, 1900), allowedMentions: { parse: [] } });
      if (res.toolCalls.length) await ctx.ops(MODULE, 'ran', { actor: msg.author.id, data: { tools: res.toolCalls.map((t) => t.name) } });
    } catch (err) {
      ctx.log.error({ err }, 'operator failed');
      await msg.reply('something broke on my end — logged it for the tech team 🛠️').catch(() => undefined);
    } finally {
      clearInterval(typing);
      busy.delete(msg.channelId);
    }
  });

  function buildTools(msg: Message): AgentTool[] {
    const actor = {
      userId: msg.author.id,
      channelId: msg.channelId,
      progress: async (text: string) => {
        if ('send' in msg.channel) await msg.channel.send({ content: text.slice(0, 1900), allowedMentions: { parse: [] } }).catch(() => undefined);
      },
    };
    return [...ctx.actions.entries()]
      .filter(([, a]) => !a.ownersOnly || ctx.isOwner(msg.author.id))
      .map(([name, a]) => ({
        name,
        description: a.description,
        input_schema: a.input,
        run: (input: Record<string, unknown>) => a.run(input, actor),
      }));
  }

  async function context(): Promise<string> {
    const models = ctx.models.all();
    return [
      `- Today: ${new Date().toISOString().slice(0, 10)} (${ctx.env.DEFAULT_TIMEZONE})`,
      `- Creators onboarded: ${models.length ? models.map((m) => `${m.display_name} (${m.slug}, @${m.socials.instagram || '?'}, lanes: ${m.lanes.join('/') || 'none'})`).join('; ') : 'none yet'}`,
      `- Content Library folders: ${ctx.settings.getString('library.category') ? 'set up' : 'not yet'}; Apify: ${ctx.api.apify.enabled ? 'connected' : 'NOT connected (no scouting/downloads)'}; GitHub write: ${ctx.env.GITHUB_TOKEN ? 'connected' : 'NOT connected (no onboarding writes)'}`,
      `- Away-reply: ${ctx.settings.getString('away.mode', 'auto')} · owners: ${ctx.ownerMentions() || 'none'}`,
      `- Daily: 06:15 snapshot → 07:00 reports (#daily-report + each girl) → 07:00 library scout + picks + trend radar → 07:30 event ideas`,
    ].join('\n');
  }

  async function recentHistory(msg: Message, botId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const fetched = await msg.channel.messages.fetch({ limit: 14, before: msg.id }).catch(() => null);
    const prior = fetched ? [...fetched.values()].reverse() : [];
    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    const push = (role: 'user' | 'assistant', content: string) => {
      if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].content += `\n${content}`;
      else turns.push({ role, content });
    };
    for (const m of prior) {
      if (!m.content) continue;
      if (m.author.id === botId) push('assistant', m.content);
      else push('user', `${m.author.displayName} (<@${m.author.id}>): ${m.content}`);
    }
    push('user', `${msg.author.displayName} (<@${msg.author.id}>): ${msg.content.replace(new RegExp(`<@!?${botId}>`, 'g'), `@${BOT_NAME} Bot`)}`);
    if (turns[0]?.role === 'assistant') turns.shift();
    return turns;
  }
}
