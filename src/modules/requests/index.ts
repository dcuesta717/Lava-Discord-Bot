import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { loadPrompt } from '../../lib/prompts.js';
import { nowIso } from '../../lib/time.js';

/**
 * Content requests (docs/source-analysis §2.2 & §2.6):
 *   staff: /request model:<slug> items:<text> [deadline] [drive_url]
 *   → Claude rewrites in the bot's voice (prompts/request.rewrite.md) → posted in her #resources with the Drive link
 *   → row in content_requests (status=requested) → Drive watcher (every 30 min) flips to 'uploaded' when files land
 *   staff: /request-status model:<slug> id:<n> status:<...>  to move it along by hand
 */
const MODULE = 'requests';
const BOT_NAME = process.env.BOT_NAME ?? 'Lava';

interface RequestRow {
  id: number;
  model_slug: string;
  drive_url: string | null;
  status: string;
  updated_at: Date;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;

  ctx.command(
    new SlashCommandBuilder()
      .setName('request')
      .setDescription('Send a content request to a model (staff)')
      .addStringOption((o) => o.setName('model').setDescription('Model slug').setRequired(true))
      .addStringOption((o) => o.setName('items').setDescription('What you need, plain words, items separated by ; (e.g. 3 photo sets; 1 scripted video)').setRequired(true))
      .addStringOption((o) => o.setName('deadline').setDescription('e.g. Friday, Sep 26'))
      .addStringOption((o) => o.setName('drive_url').setDescription('Upload folder link (auto-created if Drive is configured and omitted)')),
    async (i) => {
      const model = ctx.models.get(i.options.getString('model', true));
      if (!model) return i.reply({ content: 'unknown model slug', flags: MessageFlags.Ephemeral });
      if (!ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });

      const items = i.options.getString('items', true);
      const deadline = i.options.getString('deadline');
      let driveUrl = i.options.getString('drive_url');
      if (!driveUrl && ctx.api.drive.enabled && model.drive.root_folder_id) {
        const folder = await ctx.api.drive.createFolder(model.drive.root_folder_id, `Request ${nowIso().slice(0, 10)}`);
        driveUrl = folder.url;
      }

      const raw = `${items}${deadline ? `\nDeadline: ${deadline}` : ''}`;
      const brief = await ctx.api.claude.text(
        loadPrompt('request.rewrite', { bot_name: BOT_NAME, model_name: model.display_name.split(' ')[0], requested_by: i.user.displayName, request: raw }),
        { maxTokens: 500, temperature: 0.7 },
      );

      const [{ id }] = await sql<{ id: number }[]>`
        INSERT INTO bot.content_requests (model_slug, requested_by, raw_request, brief, drive_url, deadline)
        VALUES (${model.slug}, ${i.user.id}, ${raw}, ${brief}, ${driveUrl}, ${deadline}) RETURNING id`;
      const posted = await ctx.send(model.discord.channels.resources, { content: `${brief}${driveUrl ? `\n${driveUrl}` : ''}`.slice(0, 1950) });
      if (posted) await sql`UPDATE bot.content_requests SET discord_message_id = ${posted.id} WHERE id = ${id}`;

      await ctx.api.notion.createRow('requests', `${model.display_name} · request #${id}`, { Model: model.display_name, Status: 'requested', Deadline: deadline ?? undefined, Drive: driveUrl ?? undefined, Brief: brief });
      await ctx.ops(MODULE, 'sent', { model, actor: i.user.id, data: { id, deadline } });
      await i.editReply(`sent to ${model.display_name}'s #resources (request #${id})`);
    },
  );

  ctx.command(
    new SlashCommandBuilder()
      .setName('request-status')
      .setDescription('Update a content request (staff)')
      .addStringOption((o) => o.setName('model').setDescription('Model slug').setRequired(true))
      .addIntegerOption((o) => o.setName('id').setDescription('Request id').setRequired(true))
      .addStringOption((o) =>
        o.setName('status').setDescription('New status').setRequired(true).addChoices(
          { name: 'uploaded', value: 'uploaded' },
          { name: 'edited', value: 'edited' },
          { name: 'posted', value: 'posted' },
          { name: 'cancelled', value: 'cancelled' },
        ),
      ),
    async (i) => {
      const model = ctx.models.get(i.options.getString('model', true));
      if (!model || !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only / unknown model', flags: MessageFlags.Ephemeral });
      const id = i.options.getInteger('id', true);
      const status = i.options.getString('status', true);
      const r = await sql`UPDATE bot.content_requests SET status = ${status}, updated_at = now() WHERE id = ${id} AND model_slug = ${model.slug}`;
      if (!r.count) return i.reply({ content: 'no such request for that model', flags: MessageFlags.Ephemeral });
      await ctx.ops(MODULE, `status:${status}`, { model, actor: i.user.id, data: { id } });
      await i.reply({ content: `request #${id} → ${status}`, flags: MessageFlags.Ephemeral });
    },
  );

  // Drive watcher — every 30 min, any open request whose folder got new files → 'uploaded' + ping owners.
  if (ctx.api.drive.enabled) {
    ctx.cron('requests:drive-watch', '*/30 * * * *', ctx.env.DEFAULT_TIMEZONE, async () => {
      const open = await sql<RequestRow[]>`SELECT id, model_slug, drive_url, status, updated_at FROM bot.content_requests WHERE status = 'requested' AND drive_url IS NOT NULL`;
      for (const r of open) {
        const folderId = r.drive_url?.match(/folders\/([\w-]+)/)?.[1];
        if (!folderId) continue;
        const model = ctx.models.get(r.model_slug);
        if (!model) continue;
        const files = await ctx.api.drive.newFiles(folderId, r.updated_at.toISOString()).catch(() => []);
        if (!files.length) continue;
        await sql`UPDATE bot.content_requests SET status = 'uploaded', updated_at = now() WHERE id = ${r.id}`;
        await ctx.send(ctx.ch('content_requests_inbox'), {
          content: `📥 ${ctx.ownerMentions()} **${model.display_name}** uploaded ${files.length} file(s) for request #${r.id} → ${r.drive_url}`,
        });
        await ctx.send(model.discord.channels.resources, { content: `got the upload for request #${r.id} 🙌 team's been pinged` });
        await ctx.ops(MODULE, 'uploaded', { model, data: { id: r.id, files: files.length } });
      }
    });
  }
}
