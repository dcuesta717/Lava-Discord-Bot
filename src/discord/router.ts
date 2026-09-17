import { Events, MessageFlags, type Interaction } from 'discord.js';
import type { BotContext } from './context.js';

/** One InteractionCreate listener for the whole bot. Modules only register handlers on the context. */
export function attachRouter(ctx: BotContext) {
  ctx.client.on(Events.InteractionCreate, async (i: Interaction) => {
    try {
      if (i.isChatInputCommand()) {
        const entry = ctx.commands.get(i.commandName);
        if (!entry) return;
        const model = i.channelId ? ctx.models.forChannelOrParent(i.channelId, i.channel && 'parentId' in i.channel ? i.channel.parentId : null) : undefined;
        await entry.handler(i, model);
        return;
      }

      if (i.isButton() || i.isStringSelectMenu()) {
        const parts = i.customId.split(':');
        const prefix = `${parts[0]}:${parts[1]}`;
        const handler = ctx.components.get(prefix);
        if (!handler) return;
        const model = parts[2] ? ctx.models.get(parts[2]) : undefined;
        await handler(i, parts, model);
        return;
      }

      if (i.isModalSubmit()) {
        const parts = i.customId.split(':');
        const prefix = `${parts[0]}:${parts[1]}`;
        const handler = ctx.modals.get(prefix);
        if (!handler) return;
        const model = parts[2] ? ctx.models.get(parts[2]) : undefined;
        await handler(i, parts, model);
      }
    } catch (err) {
      ctx.log.error({ err, interaction: i.id }, 'interaction failed');
      if (i.isRepliable()) {
        const msg = { content: 'something broke on my end, the tech team has been logged 🛠️', flags: MessageFlags.Ephemeral } as const;
        if (i.deferred || i.replied) await i.followUp(msg).catch(() => undefined);
        else await i.reply(msg).catch(() => undefined);
      }
    }
  });
}
