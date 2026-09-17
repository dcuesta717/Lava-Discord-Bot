import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';

/**
 * Approve-to-autopost via Zernio (CLAUDE.md rule 5: nothing posts without a human tap).
 *   staff/model: /post model:<slug> media_url:<direct mp4/jpg url> caption_id:<n> [when:"2026-09-20 19:00"]
 *   → preview card in her #general [✅ approve & schedule] [❌]
 *   → approve: Zernio presign+upload (from URL), POST /posts scheduled at `when` or next best_time slot
 *   → posts row: scheduled → (webhook/poll not implemented: mark published manually)
 *
 * Media must be a URL Zernio's uploader can fetch (Drive "anyone with link" export URL, or the bot's own re-upload).
 */
const MODULE = 'posting';

interface PostRow {
  id: number;
  model_slug: string;
  caption_id: number | null;
  media_url: string;
  media_type: string;
  platforms: { platform: string; accountId: string }[];
  scheduled_for: string | null;
  timezone: string | null;
  status: string;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const byId = async (id: number) => (await sql<PostRow[]>`SELECT * FROM bot.posts WHERE id = ${id}`)[0];
  const approvedCaption = async (id: number | null, slug: string) =>
    id === null ? undefined : (await sql<{ final_text: string }[]>`SELECT final_text FROM bot.captions WHERE id = ${id} AND model_slug = ${slug} AND status IN ('approved','edited')`)[0];

  ctx.command(
    new SlashCommandBuilder()
      .setName('post')
      .setDescription('Queue a post for approval → Zernio')
      .addStringOption((o) => o.setName('model').setDescription('Model slug').setRequired(true))
      .addStringOption((o) => o.setName('media_url').setDescription('Direct video/image URL').setRequired(true))
      .addIntegerOption((o) => o.setName('caption_id').setDescription('Approved caption id (from /caption)').setRequired(true))
      .addStringOption((o) => o.setName('when').setDescription('Local time "YYYY-MM-DD HH:mm" (default: next best slot)'))
      .addStringOption((o) => o.setName('platforms').setDescription('Comma list, default: all configured (instagram,tiktok)')),
    async (i) => {
      const model = ctx.models.get(i.options.getString('model', true));
      if (!model || !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only / unknown model', flags: MessageFlags.Ephemeral });
      if (!ctx.api.zernio.enabled) return i.reply({ content: 'ZERNIO_API_KEY not set', flags: MessageFlags.Ephemeral });
      const captionId = i.options.getInteger('caption_id', true);
      const cap = await approvedCaption(captionId, model.slug);
      if (!cap) return i.reply({ content: 'that caption id is not approved for this model', flags: MessageFlags.Ephemeral });

      const wanted = (i.options.getString('platforms') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const targets = model.zernio.accounts.filter((a) => !wanted.length || wanted.includes(a.platform));
      if (!targets.length) return i.reply({ content: 'no Zernio accounts configured for that model/platform in model.yaml', flags: MessageFlags.Ephemeral });

      const mediaUrl = i.options.getString('media_url', true);
      const when = i.options.getString('when') ?? nextBestSlot(model);
      const mediaType = /\.(jpe?g|png|webp)(\?|$)/i.test(mediaUrl) ? 'image' : 'video';
      const [{ id }] = await sql<{ id: number }[]>`
        INSERT INTO bot.posts (model_slug, caption_id, media_url, media_type, platforms, scheduled_for, timezone)
        VALUES (${model.slug}, ${captionId}, ${mediaUrl}, ${mediaType}, ${sql.json(targets)}, ${when}, ${model.timezone}) RETURNING id`;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`posting:approve:${model.slug}:${id}`).setLabel('approve & schedule').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`posting:reject:${model.slug}:${id}`).setLabel('reject').setEmoji('❌').setStyle(ButtonStyle.Danger),
      );
      const msg = await ctx.send(model.discord.channels.general, {
        content: [
          `📤 **post preview #${id}** → ${targets.map((t) => t.platform).join(' + ')} · ${when} (${model.timezone})`,
          `> ${cap.final_text}`,
          mediaUrl,
          `<@${model.discord.user_id}> or ${ctx.ownerMentions()} — tap ✅ to schedule`,
        ].join('\n'),
        components: [row],
      });
      if (msg) await sql`UPDATE bot.posts SET discord_message_id = ${msg.id} WHERE id = ${id}`;
      await i.reply({ content: `preview posted in ${model.display_name}'s channel (#${id})`, flags: MessageFlags.Ephemeral });
    },
  );

  ctx.component('posting:approve', async (i, parts, model) => {
    const post = await byId(Number(parts[3]));
    if (!model || !post || post.status !== 'draft') return i.reply({ content: 'nothing to approve', flags: MessageFlags.Ephemeral });
    if (i.user.id !== model.discord.user_id && !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'only the model or staff can approve', flags: MessageFlags.Ephemeral });
    await i.deferUpdate();
    try {
      const cap = await approvedCaption(post.caption_id, model.slug);
      if (!cap) throw new Error('caption no longer approved');
      const ext = post.media_type === 'image' ? 'jpg' : 'mp4';
      const publicUrl = await ctx.api.zernio.uploadFromUrl(post.media_url, `${model.code}-${post.id}.${ext}`, post.media_type === 'image' ? 'image/jpeg' : 'video/mp4');
      const created = await ctx.api.zernio.createPost({
        content: cap.final_text,
        mediaItems: [{ url: publicUrl, type: post.media_type === 'image' ? 'image' : 'video' }],
        platforms: post.platforms.map((t) => ({
          platform: t.platform,
          accountId: t.accountId,
          platformSpecificData: t.platform === 'instagram' ? { shareToFeed: true } : undefined,
        })),
        scheduledFor: DateTime.fromFormat(post.scheduled_for!, 'yyyy-MM-dd HH:mm', { zone: model.timezone }).toFormat("yyyy-MM-dd'T'HH:mm:ss"),
        timezone: model.timezone,
      });
      await sql`UPDATE bot.posts SET status = 'scheduled', zernio_post_id = ${created.id}, approved_by = ${i.user.id}, updated_at = now() WHERE id = ${post.id}`;
      await i.editReply({ content: `✅ scheduled via Zernio (post ${created.id}) for ${post.scheduled_for} ${model.timezone} — approved by <@${i.user.id}>`, components: [] });
      await ctx.api.notion.createRow('posts', `${model.display_name} · post #${post.id}`, { Model: model.display_name, Status: 'scheduled', 'Scheduled for': post.scheduled_for ?? undefined, Zernio: created.id });
      await ctx.ops(MODULE, 'scheduled', { model, actor: i.user.id, data: { id: post.id, zernio: created.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await sql`UPDATE bot.posts SET status = 'failed', error = ${message}, updated_at = now() WHERE id = ${post.id}`;
      ctx.log.error({ err, post: post.id }, 'zernio schedule failed');
      await i.editReply({ content: `❌ couldn't schedule: ${message.slice(0, 300)}`, components: [] });
      await ctx.ops(MODULE, 'failed', { model, data: { id: post.id, error: message } });
    }
  });

  ctx.component('posting:reject', async (i, parts, model) => {
    const post = await byId(Number(parts[3]));
    if (!model || !post) return;
    await sql`UPDATE bot.posts SET status = 'rejected', approved_by = ${i.user.id}, updated_at = now() WHERE id = ${post.id}`;
    await i.update({ content: `❌ post #${post.id} rejected by <@${i.user.id}>`, components: [] });
  });

  function nextBestSlot(model: Model): string {
    const now = DateTime.now().setZone(model.timezone);
    const slots = model.zernio.best_times.map((t) => {
      const [h, m] = t.split(':').map(Number);
      let dt = now.set({ hour: h, minute: m, second: 0, millisecond: 0 });
      if (dt <= now.plus({ minutes: 15 })) dt = dt.plus({ days: 1 });
      return dt;
    });
    slots.sort((a, b) => a.toMillis() - b.toMillis());
    return slots[0].toFormat('yyyy-MM-dd HH:mm');
  }
}
